import os
import json
import tempfile
import shutil
import ast
import re
from flask import Flask, render_template, request, jsonify, session
from werkzeug.utils import secure_filename
import threading
import uuid

# Import the threat modeling functionality
from main import perform_textual_analysis, perform_whitebox_analysis, build_threat_model
# Import llmConfig to get available models
from llm import llmConfig

app = Flask(__name__, static_folder='static')
app.secret_key = os.urandom(24)
app.config['UPLOAD_FOLDER'] = os.path.join(tempfile.gettempdir(), 'threat_model_uploads')
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB limit

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Store ongoing analysis tasks
analysis_tasks = {}

def format_error_message(error_message):
    """
    Format error messages to make them more readable, especially for lists of feedback items.
    """
    # Check if the error message contains a list representation
    list_pattern = r'\[.*?\]'
    match = re.search(list_pattern, error_message)
    
    if match:
        try:
            # Extract the list portion and convert it to a Python list
            list_str = match.group(0)
            feedback_items = ast.literal_eval(list_str)
            
            if isinstance(feedback_items, list):
                # Format the list items as HTML bullet points
                formatted_items = "<ul>" + "".join([f"<li>{item}</li>" for item in feedback_items]) + "</ul>"
                # Replace the original list representation with the formatted version
                formatted_message = error_message.replace(list_str, formatted_items)
                return formatted_message
        except (SyntaxError, ValueError):
            # If there's any error parsing the list, return the original message
            pass
    
    return error_message

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze_description', methods=['POST'])
def analyze_description():
    description = request.form.get('description', '')
    model = request.form.get('model', None)
    
    if not description:
        return jsonify({'error': 'No description provided'}), 400
    
    # Generate a unique task ID
    task_id = str(uuid.uuid4())
    
    # Create a thread to run the analysis
    def run_analysis():
        try:
            # We set use_parallel to False by default, modify if necessary
            threat_model = perform_textual_analysis(description, use_parallel=False, model=model)
            analysis_tasks[task_id] = {'status': 'completed', 'result': threat_model}
        except Exception as e:
            error_message = str(e)
            # Format the error message if it contains feedback items
            formatted_error = format_error_message(error_message)
            analysis_tasks[task_id] = {'status': 'failed', 'error': formatted_error}
    
    # Store the task status
    analysis_tasks[task_id] = {'status': 'in_progress'}
    
    # Start the analysis in a background thread
    thread = threading.Thread(target=run_analysis)
    thread.daemon = True
    thread.start()
    
    return jsonify({'task_id': task_id})

@app.route('/analyze_codebase', methods=['POST'])
def analyze_codebase():
    if 'codebase' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['codebase']
    model = request.form.get('model', None)
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    # Generate a unique task ID and create a dedicated folder
    task_id = str(uuid.uuid4())
    task_dir = os.path.join(app.config['UPLOAD_FOLDER'], task_id)
    os.makedirs(task_dir, exist_ok=True)
    
    # Handle zip file upload - save and extract
    try:
        zip_path = os.path.join(task_dir, secure_filename(file.filename))
        file.save(zip_path)
        
        # Extract if it's a zip file
        if zip_path.endswith('.zip'):
            import zipfile
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(task_dir)
        
        # Create a thread to run the analysis
        def run_analysis():
            try:
                threat_model = perform_whitebox_analysis(task_dir, model=model)
                analysis_tasks[task_id] = {'status': 'completed', 'result': threat_model}
            except Exception as e:
                error_message = str(e)
                # Format the error message if it contains feedback items
                formatted_error = format_error_message(error_message)
                analysis_tasks[task_id] = {'status': 'failed', 'error': formatted_error}
            finally:
                # Clean up temporary directory
                if os.path.exists(task_dir):
                    shutil.rmtree(task_dir)
        
        # Store the task status
        analysis_tasks[task_id] = {'status': 'in_progress'}
        
        # Start the analysis in a background thread
        thread = threading.Thread(target=run_analysis)
        thread.daemon = True
        thread.start()
        
        return jsonify({'task_id': task_id})
    
    except Exception as e:
        # Clean up on error
        if os.path.exists(task_dir):
            shutil.rmtree(task_dir)
        return jsonify({'error': str(e)}), 500

@app.route('/task_status/<task_id>', methods=['GET'])
def task_status(task_id):
    task = analysis_tasks.get(task_id)
    if not task:
        return jsonify({'status': 'not_found'}), 404
    
    status_data = {'status': task['status']}
    
    if task['status'] == 'completed':
        status_data['result'] = task['result']
    elif task['status'] == 'failed':
        status_data['error'] = task['error']
    
    return jsonify(status_data)

@app.route('/visualize/<task_id>')
def visualize(task_id):
    task = analysis_tasks.get(task_id)
    if not task or task['status'] != 'completed':
        return render_template('error.html', message='Analysis task not found or incomplete')
    
    return render_template('graph.html', task_id=task_id)

@app.route('/get_task_data/<task_id>')
def get_task_data(task_id):
    task = analysis_tasks.get(task_id)
    if not task or task['status'] != 'completed':
        return jsonify({'error': 'Task not found or incomplete'}), 404
    
    return jsonify(task['result'])

# Clean up old tasks (in a produ
@app.before_request
def cleanup_old_tasks():
    # This is a simple approach - in production, you'd use a proper task queue
    tasks_to_remove = []
    for task_id, task in analysis_tasks.items():
        if task.get('status') in ('completed', 'failed') and len(analysis_tasks) > 100:
            tasks_to_remove.append(task_id)
    
    for task_id in tasks_to_remove[:max(0, len(analysis_tasks) - 50)]:  # Keep the 50 most recent
        del analysis_tasks[task_id]

if __name__ == '__main__':
    app.run(debug=True)
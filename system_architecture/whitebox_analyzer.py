# system_architecture/whitebox_analyzer.py
# -------------------------------------------------------------------
# Whitebox Analyzer with a two-step approach:
# 1) Ask LLM for a general list of common web app components to look for.
# 2) Use LLM to analyze the codebase for each component.
# 3) Build a large text summary containing found references, then feed it
#    as a single "application description" to system_analyzer.

import os
import json
from typing import Dict, Any, List, Set, Tuple

from llm import llmConfig
from llm.prompts import FILE_ANALYSIS_PROMPT, FILE_CHUNK_ANALYSIS_PROMPT
from system_architecture.system_analyzer import get_system_architecture

# Max files to scan in the codebase
MAX_FILES = 30
# Characters per chunk to stay within token limits
CHUNK_SIZE = 3000

GENERAL_WEB_APP_COMPONENTS = ["entry points", "routes", "config", "package.json", "directory structure", "controllers", "models", "middleware", "migrations", "docker files", "components", "services", "auth", "database", "api", "utils", "views", "assets", "tests", "schemas"]

def get_file_extensions() -> Dict[str, List[str]]:
    """
    Returns categorized file extensions to prioritize for analysis
    """
    return {
        "high_priority": [".js", ".ts", ".py", ".php", ".rb", ".go", ".java"],
        "config": [".json", ".yaml", ".yml", ".env", ".config", ".toml"],
        "frontend": [".html", ".jsx", ".tsx", ".vue", ".css"],
        "documentation": [".md", ".txt"],
        "infrastructure": ["Dockerfile", "docker-compose.yml"]
    }

def should_analyze_file(file_path: str) -> bool:
    """
    Determines if a file should be analyzed based on its extension
    """
    ext_categories = get_file_extensions()
    
    # Flatten the list of extensions
    all_extensions = []
    for exts in ext_categories.values():
        all_extensions.extend(exts)
    
    # Special handling for files without extensions (like "Dockerfile")
    filename = os.path.basename(file_path)
    if filename in [item for sublist in ext_categories.values() for item in sublist if not item.startswith('.')]:
        return True
    
    # Check if the file extension is in our list
    ext = os.path.splitext(file_path)[1].lower()
    return ext in all_extensions

def analyze_file_with_llm(file_path: str, component_names: List[str]) -> Dict[str, str]:
    """
    Analyzes a file using LLM to identify components and their descriptions
    Processes the file in chunks to stay within token limits
    """
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            file_content = f.read()
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return {}
    
    # If file is too small, analyze it in one go
    if len(file_content) <= CHUNK_SIZE:
        return analyze_single_chunk(file_path, file_content, component_names)
    
    # Otherwise, split into chunks and analyze each
    return analyze_multiple_chunks(file_path, file_content, component_names)

def analyze_single_chunk(file_path: str, content: str, component_names: List[str]) -> Dict[str, str]:
    """
    Analyzes a single chunk of file content to identify components
    """
    prompt_data = {
        "file_path": file_path,
        "file_content": content,
        "component_names": ", ".join(component_names)
    }
    
    response = llmConfig.get_llm_response(
        system_message=FILE_ANALYSIS_PROMPT,
        prompt=json.dumps(prompt_data),
        temperature=0.2
    )
    
    try:
        # Try to parse the response as JSON
        return parse_llm_response(response)
    except Exception as e:
        print(f"Error parsing LLM response for {file_path}: {e}")
        return {}

def analyze_multiple_chunks(file_path: str, content: str, component_names: List[str]) -> Dict[str, str]:
    """
    Analyzes a file in multiple chunks, merging the results
    """
    chunks = [content[i:i+CHUNK_SIZE] for i in range(0, len(content), CHUNK_SIZE)]
    all_findings = {}
    
    for i, chunk in enumerate(chunks):
        prompt_data = {
            "file_path": file_path,
            "chunk_number": i+1,
            "total_chunks": len(chunks),
            "file_content": chunk,
            "component_names": ", ".join(component_names),
            "previous_findings": json.dumps(all_findings)
        }
        
        response = llmConfig.get_llm_response(
            system_message=FILE_CHUNK_ANALYSIS_PROMPT,
            prompt=json.dumps(prompt_data),
            temperature=0.2
        )
        
        try:
            chunk_findings = parse_llm_response(response)
            # Merge the findings
            for comp, desc in chunk_findings.items():
                if comp in all_findings:
                    # Append new information if it's not redundant
                    if desc and desc not in all_findings[comp]:
                        all_findings[comp] = f"{all_findings[comp]}; {desc}"
                else:
                    all_findings[comp] = desc
        except Exception as e:
            print(f"Error parsing LLM response for chunk {i+1} of {file_path}: {e}")
    
    return all_findings

def parse_llm_response(response: str) -> Dict[str, str]:
    """
    Parses the LLM response to extract component descriptions
    Handles different formats that the LLM might return
    """
    # First try to parse as JSON directly
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        pass
    
    # Try to extract JSON from markdown code blocks
    import re
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass
    
    # Fallback: try to extract key-value pairs from text
    components = {}
    lines = response.strip().split('\n')
    current_component = None
    
    for line in lines:
        component_match = re.match(r'^[#*-]?\s*"?([^:]+)"?\s*:\s*(.+)', line)
        if component_match:
            current_component = component_match.group(1).strip(' "\'')
            description = component_match.group(2).strip(' "\'')
            components[current_component] = description
    
    return components

def scan_codebase_for_components(code_dir: str, component_names: List[str]) -> Dict[str, Dict[str, str]]:
    """
    Step 2) Scan the codebase for each component using LLM analysis.
    Returns a mapping of component_name -> {file_path: description}
    """
    results = {c: {} for c in component_names}
    file_count = 0
    
    for root, dirs, files in os.walk(code_dir):
        # Skip hidden directories and common non-application directories
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', 'venv', '__pycache__', '.git']]
        
        for fname in files:
            file_path = os.path.join(root, fname)
            
            # Skip if we shouldn't analyze this file
            if not should_analyze_file(file_path):
                continue
            
            file_count += 1
            if file_count > MAX_FILES:
                return results
                        
            # Analyze the file with LLM
            file_components = analyze_file_with_llm(file_path, component_names)
            
            # Add findings to results
            for comp_name, description in file_components.items():
                if comp_name in results:
                    results[comp_name][file_path] = description
    
    return results

def build_large_summary(component_references: Dict[str, Dict[str, str]]) -> str:
    """
    Step 3) Build a big textual summary with all references found, grouped by component.
    This summary will be used as the 'application description' for the system_analyzer.
    """
    summary = "Below are the references found in the codebase for each typical web app component:\n\n"
    
    for comp_name, file_descriptions in component_references.items():
        summary += f"=== {comp_name.upper()} ===\n"
        
        if not file_descriptions:
            summary += "No references found in the scanned code.\n\n"
        else:
            # Consolidate descriptions by file
            for file_path, description in file_descriptions.items():
                summary += f"File: {file_path}\n"
                summary += f"Description: {description}\n\n"
    
    return summary

def get_whitebox_architecture(code_dir: str) -> Dict[str, Any]:
    """
    Main function orchestrating the whitebox approach:
      1) Get a general list of components from the LLM.
      2) Scan codebase for each component using LLM.
      3) Build a large text summary from findings.
      4) Send the summary to an LLM for a final architecture extraction in JSON.
    """
    # Step 1
    general_components = GENERAL_WEB_APP_COMPONENTS

    # Step 2
    references_map = scan_codebase_for_components(code_dir, general_components)

    # Step 3
    large_summary_text = build_large_summary(references_map)

    # Step 4: We feed the large_summary_text to the system_analyzer
    final_architecture = get_system_architecture(large_summary_text)

    return final_architecture
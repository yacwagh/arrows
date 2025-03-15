document.addEventListener('DOMContentLoaded', () => {
    // Form elements
    const descriptionForm = document.getElementById('descriptionForm');
    const codebaseForm = document.getElementById('codebaseForm');
    const appDescription = document.getElementById('appDescription');
    const codebaseUpload = document.getElementById('codebaseUpload');
    const modelSelect = document.getElementById('modelSelect');
    const modelSelectCodebase = document.getElementById('modelSelectCodebase');

    // UI elements
    const analysisProgress = document.getElementById('analysisProgress');
    const errorAlert = document.getElementById('errorAlert');
    const errorMessage = document.getElementById('errorMessage');
    const loadingMessage = document.getElementById('loadingMessage');
    
    // Loading messages array
    const loadingMessages = [
        "Cooking up a storm of vulnerabilities...",
        "Debugging the debugger while you wait...",
        "Asking the firewall if it remembered to lock the door...",
        "Counting all the bits that didn’t make it to the party...",
        "Checking if the hackers took today off (fingers crossed)...",
        "Making sure the code isn’t skipping leg day in its security routine...",
        "Searching for vulnerabilities, but they’re hiding too well...",
        "Brewing a fresh pot of encryption tea...",
        "Teaching AI how to spot phishing scams without falling for them...",
        "Making sure your passwords aren’t still using '1234' as their workout plan...",
        "Double-checking if the firewalls are fully caffeinated and ready to fight...",
        "Scanning the code for fashion faux pas in cybersecurity style...",
        "Consulting the Oracle of Security Wisdom (spoiler: it’s just us)…",
        "Ensuring the hackers haven’t RSVP’d to this party...",
        "Polishing the security magnifying glass for extra sharpness...",
        "Reading the security runes to predict future threats...",
        "Giving the code a pep talk about staying secure...",
        "Checking if the SSL certificates remembered to renew their gym membership...",
        "Asking the IDS/IPS systems if they’ve been getting enough sleep lately..."
    ];

    let currentMessageIndex = 0;
    let messageInterval;

    // Function to update loading message
    function updateLoadingMessage() {
        loadingMessage.textContent = loadingMessages[currentMessageIndex];
        currentMessageIndex = (currentMessageIndex + 1) % loadingMessages.length;
    }

    // Start message rotation
    function startMessageRotation() {
        updateLoadingMessage();
        messageInterval = setInterval(updateLoadingMessage, 3000);
    }

    // Stop message rotation
    function stopMessageRotation() {
        if (messageInterval) {
            clearInterval(messageInterval);
            messageInterval = null;
        }
    }

    // Handle description form submission
    descriptionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Validate input
        if (!appDescription.value.trim()) {
            showError('Please provide a description of your application.');
            return;
        }
        
        // Hide any previous errors
        hideError();
        
        // Show loading UI
        showProgress();
        
        try {
            const formData = new FormData();
            formData.append('description', appDescription.value);
            formData.append('model', modelSelect.value);
            
            const response = await fetch('/analyze_description', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Start polling for task status
                pollTaskStatus(data.task_id);
            } else {
                showError(data.error || 'Failed to start analysis.');
                hideProgress();
            }
        } catch (error) {
            showError('Error submitting analysis: ' + error.message);
            hideProgress();
        }
    });
    
    // Handle codebase form submission
    codebaseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Validate input
        if (!codebaseUpload.files[0]) {
            showError('Please select a ZIP file containing your codebase.');
            return;
        }
        
        // Validate file type
        const file = codebaseUpload.files[0];
        if (!file.name.toLowerCase().endsWith('.zip')) {
            showError('Please upload a ZIP file.');
            return;
        }
        
        // Hide any previous errors
        hideError();
        
        // Show loading UI
        showProgress();
        
        try {
            const formData = new FormData();
            formData.append('codebase', file);
            formData.append('model', modelSelectCodebase.value);
            
            const response = await fetch('/analyze_codebase', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Start polling for task status
                pollTaskStatus(data.task_id);
            } else {
                showError(data.error || 'Failed to start analysis.');
                hideProgress();
            }
        } catch (error) {
            showError('Error submitting analysis: ' + error.message);
            hideProgress();
        }
    });
    
    // Poll for task status
    function pollTaskStatus(taskId) {
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/task_status/${taskId}`);
                const data = await response.json();
                
                if (response.ok) {
                    if (data.status === 'completed') {
                        clearInterval(interval);
                        hideProgress();
                        // Redirect to visualization page
                        window.location.href = `/visualize/${taskId}`;
                    } else if (data.status === 'failed') {
                        clearInterval(interval);
                        hideProgress();
                        showError(data.error || 'Analysis failed.');
                    }
                    // If status is 'in_progress', continue polling
                } else {
                    clearInterval(interval);
                    hideProgress();
                    showError(data.error || 'Failed to check analysis status.');
                }
            } catch (error) {
                clearInterval(interval);
                hideProgress();
                showError('Error checking analysis status: ' + error.message);
            }
        }, 2000); // Poll every 2 seconds
    }
    
    // Helper functions for UI management
    function showProgress() {
        analysisProgress.classList.remove('d-none');
        startMessageRotation();
    }
    
    function hideProgress() {
        analysisProgress.classList.add('d-none');
        stopMessageRotation();
    }
    
    function showError(message) {
        errorMessage.innerHTML = message;
        errorAlert.classList.remove('d-none');
    }
    
    function hideError() {
        errorAlert.classList.add('d-none');
    }
});
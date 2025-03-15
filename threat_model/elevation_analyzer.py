"""
Elevation of Privilege Threat Analyzer module.

This module analyzes the system architecture for elevation of privilege threats.
Elevation of Privilege involves gaining unauthorized access to resources or 
capabilities reserved for higher privilege levels.
"""

from typing import Dict, Any, List, Optional
from llm import llmConfig
from llm.prompts import ELEVATION_EXPERT_PROMPT
from utils.utils import extract_threats_from_response

def analyze(architecture: Dict[str, Any], model: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Analyze the system architecture for elevation of privilege threats.
    
    Args:
        architecture: Dictionary containing the system architecture
        model: Optional model name to use for the LLM
        
    Returns:
        List of identified elevation of privilege threats
    """
    prompt = f"""
System Architecture:
{architecture}

Identify all potential Elevation of Privilege threats in this system.
"""
    
    response = llmConfig.get_llm_response(
        prompt=prompt,
        system_message=ELEVATION_EXPERT_PROMPT,
        temperature=0.3,  # Slightly higher temperature for more variety in threats
        model=model
    )
    
    # Use the utility function to extract threats
    return extract_threats_from_response(response, "Elevation of Privilege")
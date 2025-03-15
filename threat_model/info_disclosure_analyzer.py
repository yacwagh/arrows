"""
Information Disclosure Threat Analyzer module.

This module analyzes the system architecture for information disclosure threats.
Information Disclosure occurs when sensitive information is exposed to 
unauthorized users.
"""

from typing import Dict, Any, List, Optional
from llm import llmConfig
from llm.prompts import INFO_DISCLOSURE_EXPERT_PROMPT
from utils.utils import extract_threats_from_response

def analyze(architecture: Dict[str, Any], model: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Analyze the system architecture for information disclosure threats.
    
    Args:
        architecture: Dictionary containing the system architecture
        model: Optional model name to use for the LLM
        
    Returns:
        List of identified information disclosure threats
    """
    prompt = f"""
System Architecture:
{architecture}

Identify all potential Information Disclosure threats in this system.
"""
    
    response = llmConfig.get_llm_response(
        prompt=prompt,
        system_message=INFO_DISCLOSURE_EXPERT_PROMPT,
        temperature=0.3,  # Slightly higher temperature for more variety in threats
        model=model
    )
    
    # Use the utility function to extract threats
    return extract_threats_from_response(response, "Information Disclosure")
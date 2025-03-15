"""
System Architecture Analyzer module.

This module is responsible for extracting the system architecture (components,
data flows, trust boundaries, and assets) from a textual description using LLM.
"""

from typing import Dict, Any
from llm import llmConfig
from llm.prompts import SYSTEM_ANALYZER_PROMPT
import json
import re

def get_system_architecture(description: str, model: str = None) -> Dict[str, Any]:
    prompt = f"""
            Application Description:

            {description}

            Based on this description, identify and extract all system architecture elements needed for threat modeling.
            """
    
    response = llmConfig.get_llm_response(
        prompt=prompt,
        system_message=SYSTEM_ANALYZER_PROMPT,
        temperature=0.2,  # Lower temperature for more deterministic results
        model=model
    )
    
    try:
        json_match = re.search(r'```json\s*([\s\S]*?)\s*```', response)
        if json_match:
            json_str = json_match.group(1)
            return json.loads(json_str)
        
        if response.strip().startswith('{') and response.strip().endswith('}'):
            return json.loads(response.strip())
        
        raise ValueError("Could not extract JSON from LLM response")
        
    except (json.JSONDecodeError, ValueError) as e:
        raise ValueError(f"Failed to parse system architecture from LLM: {str(e)}\n\nResponse: {response}")
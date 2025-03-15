"""
Utility functions for threat modeling modules.

This module contains shared functionality used across the threat modeling modules.
"""

import json
import re
from typing import List, Dict, Any

def extract_threats_from_response(response: str, default_category: str) -> List[Dict[str, Any]]:
    try:
        # Try to extract JSON from the response
        # First try to find JSON between triple backticks
        json_match = re.search(r'```json\s*([\s\S]*?)\s*```', response)
        if json_match:
            json_str = json_match.group(1)
            threats = json.loads(json_str)
        # If that fails, try to find a JSON array in the response
        elif response.strip().startswith('[') and response.strip().endswith(']'):
            threats = json.loads(response.strip())
        else:
            # If no JSON found, create an empty list
            print(f"Warning: Could not extract JSON from {default_category} threats response.")
            threats = []
        
        # Add category if missing
        for threat in threats:
            if "category" not in threat:
                threat["category"] = default_category
        
        return threats
        
    except Exception as e:
        print(f"Error parsing {default_category} threats: {str(e)}")
        return []
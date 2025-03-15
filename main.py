"""
Core functionality for the AI Agent for Threat Modeling.
Provides threat modeling analysis functions used by the web application.
"""

import json
from typing import Dict, List, Any

from llm import llmConfig
from system_architecture import system_analyzer, whitebox_analyzer
from threat_model import stride_analyzer


def perform_whitebox_analysis(code_dir: str, model: str = None) -> Dict[str, Any]:
    """Perform whitebox analysis on a code directory."""
    
    try:
        # Extract architecture from source code
        architecture_init = whitebox_analyzer.get_whitebox_architecture(code_dir)
        if not architecture_init or "components" not in architecture_init:
            raise ValueError("Whitebox analysis did not produce a valid architecture JSON.")

        analyzed_architecture = system_analyzer.get_system_architecture(architecture_init, model=model)

        # Run STRIDE analysis
        threats = stride_analyzer.analyze_threats_parallel(analyzed_architecture, model=model)

        return build_threat_model(
            "Analyzed Application (Whitebox)",
            "Architecture auto-discovered from code",
            analyzed_architecture,
            threats
        )
    except Exception as e:
        raise Exception(f"Error during whitebox analysis: {str(e)}")


def perform_textual_analysis(description: str, use_parallel: bool = False, model: str = None) -> Dict[str, Any]:
    """Perform textual analysis on an application description."""
    
    completeness_check = llmConfig.getJSONResponseLLM(description, model=model)
    if completeness_check.get("complete") == "no":
        feedback = completeness_check.get("feedback", [])
        if isinstance(feedback, list) and feedback:
            # Return a formatted error message with the list of missing details
            raise ValueError(f"More details needed for effective threat modeling: {feedback}")
        else:
            # Fallback for non-list or empty feedback
            raise ValueError("More details needed for effective threat modeling. Please provide more comprehensive information about your application architecture, data flows, and security mechanisms.")
        
    try:
        arch = system_analyzer.get_system_architecture(description, model=model)
                
        # Use parallel or sequential threat analysis based on parameter
        if use_parallel:
            threats = stride_analyzer.analyze_threats_parallel(arch, model=model)
        else:
            threats = stride_analyzer.analyze_threats(arch, model=model)

        truncated_desc = description[:100] + "..." if len(description) > 100 else description
        return build_threat_model("Analyzed Application", truncated_desc, arch, threats)
    except Exception as e:
        raise Exception(f"Error during textual analysis: {str(e)}")


def build_threat_model(name: str, description: str, architecture: Dict[str, Any], 
                       threats: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "application": {
            "name": name,
            "description": description,
            "owner": "Threat Modeling Tool User"
        },
        "components": architecture.get("components", []),
        "assets": architecture.get("assets", []),
        "dataFlows": architecture.get("dataFlows", []),
        "trustBoundaries": architecture.get("trustBoundaries", []),
        "threats": threats,
    }
"""
STRIDE Threat Analysis Coordinator module.

This module orchestrates the STRIDE threat analysis by calling each
individual analyzer (Spoofing, Tampering, Repudiation, etc.) and
combining their results.
"""

from typing import Dict, Any, List, Optional
import concurrent.futures
from . import spoofing_analyzer
from . import tampering_analyzer
from . import repudiation_analyzer
from . import info_disclosure_analyzer
from . import dos_analyzer
from . import elevation_analyzer

def analyze_threats(architecture: Dict[str, Any], model: Optional[str] = None) -> List[Dict[str, Any]]:
    all_threats = []
    spoofing_threats = spoofing_analyzer.analyze(architecture, model=model)
    all_threats.extend(spoofing_threats)
    
    tampering_threats = tampering_analyzer.analyze(architecture, model=model)
    all_threats.extend(tampering_threats)
    
    repudiation_threats = repudiation_analyzer.analyze(architecture, model=model)
    all_threats.extend(repudiation_threats)
    
    info_disclosure_threats = info_disclosure_analyzer.analyze(architecture, model=model)
    all_threats.extend(info_disclosure_threats)
    
    dos_threats = dos_analyzer.analyze(architecture, model=model)
    all_threats.extend(dos_threats)
    
    elevation_threats = elevation_analyzer.analyze(architecture, model=model)
    all_threats.extend(elevation_threats)
    
    # Assign unique IDs to each threat
    for i, threat in enumerate(all_threats):
        if 'id' not in threat:
            threat['id'] = f"threat-{i+1}"
    
    return all_threats


def analyze_threats_parallel(architecture: Dict[str, Any], model: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Analyze the given architecture for STRIDE threats in parallel.
    
    Args:
        architecture: Dictionary containing the system architecture details.
        model: Optional model name to use for the LLM
    
    Returns:
        List of identified threats.
    """
    all_threats = []
    
    # Define analyzer tasks: (name, analyzer_function)
    analyzers = [
        ("Spoofing", spoofing_analyzer.analyze),
        ("Tampering", tampering_analyzer.analyze),
        ("Repudiation", repudiation_analyzer.analyze),
        ("Information Disclosure", info_disclosure_analyzer.analyze),
        ("Denial of Service", dos_analyzer.analyze),
        ("Elevation of Privilege", elevation_analyzer.analyze)
    ]
    
    # Execute analyses in parallel
    with concurrent.futures.ThreadPoolExecutor() as executor:
        # Submit all tasks
        future_to_name = {}
        for name, analyzer in analyzers:
            print(f" - Analyzing for {name} threats...")
            future = executor.submit(analyzer, architecture, model=model)
            future_to_name[future] = name
        
        # Process results as they complete
        for future in concurrent.futures.as_completed(future_to_name):
            name = future_to_name[future]
            try:
                threats = future.result()
                all_threats.extend(threats)
            except Exception as e:
                print(f" - Error during {name} analysis: {e}")
    
    # Assign unique IDs to each threat
    for i, threat in enumerate(all_threats):
        if 'id' not in threat:
            threat['id'] = f"threat-{i+1}"
    
    return all_threats
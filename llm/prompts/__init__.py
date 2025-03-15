# Import validator prompt
from llm.prompts.threat_modeling_validator import THREAT_MODELING_EXPERT_PROMPT

# Import architecture prompts
from llm.prompts.system_analyzer import SYSTEM_ANALYZER_PROMPT

# Import STRIDE prompts
from .stride.spoofing_expert import SPOOFING_EXPERT_PROMPT
from .stride.tampering_expert import TAMPERING_EXPERT_PROMPT
from .stride.repudiation_expert import REPUDIATION_EXPERT_PROMPT
from .stride.info_disclosure_expert import INFO_DISCLOSURE_EXPERT_PROMPT
from .stride.dos_expert import DOS_EXPERT_PROMPT
from .stride.elevation_expert import ELEVATION_EXPERT_PROMPT

# Import code analysis prompts
from .code_analysis.file_analyzer import FILE_ANALYSIS_PROMPT
from .code_analysis.file_chunk_analyzer import FILE_CHUNK_ANALYSIS_PROMPT

# Export all prompts
__all__ = [
    'THREAT_MODELING_EXPERT_PROMPT',
    'SYSTEM_ANALYZER_PROMPT',
    'SPOOFING_EXPERT_PROMPT',
    'TAMPERING_EXPERT_PROMPT',
    'REPUDIATION_EXPERT_PROMPT',
    'INFO_DISCLOSURE_EXPERT_PROMPT',
    'DOS_EXPERT_PROMPT',
    'ELEVATION_EXPERT_PROMPT',
    'FILE_ANALYSIS_PROMPT',
    'FILE_CHUNK_ANALYSIS_PROMPT'
]
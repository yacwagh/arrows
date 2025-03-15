"""
Configuration module for LLM integration using OpenRouter or OpenAI API.
Provides functions to interact with the LLM.
"""

from dotenv import load_dotenv
import os
import json
import sys
from typing import Dict, Any, Optional
from openai import OpenAI
from llm.prompts import THREAT_MODELING_EXPERT_PROMPT

# Environment variables for configuration
load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
USE_OPENAI = os.getenv("USE_OPENAI", "false").lower() == "true"

# Default model based on API choice
DEFAULT_MODEL = "gpt-3.5-turbo" if USE_OPENAI else "openai/gpt-3.5-turbo"

# Initialize OpenAI client based on API choice
if USE_OPENAI:
    if not OPENAI_API_KEY:
        raise ValueError("OpenAI API key not found in environment variables. Set OPENAI_API_KEY in .env file.")
    client = OpenAI(api_key=OPENAI_API_KEY)
else:
    if not OPENROUTER_API_KEY:
        raise ValueError("OpenRouter API key not found in environment variables. Set OPENROUTER_API_KEY in .env file.")
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
    )

def get_llm_response(prompt: str, system_message: Optional[str] = None, temperature: float = 0.7, model: Optional[str] = None) -> str:
    """
    Get a response from the LLM using either OpenAI or OpenRouter.
    
    Args:
        prompt: The prompt to send to the LLM
        system_message: Optional system message to set context
        temperature: Sampling temperature
        model: The model to use (defaults to DEFAULT_MODEL if None)
        
    Returns:
        LLM response text
    """
    messages = []
    
    if system_message:
        messages.append({"role": "system", "content": system_message})
    
    messages.append({"role": "user", "content": prompt})
    
    # Adjust model name based on API choice
    if not USE_OPENAI and model and not model.startswith(("openai/", "anthropic/", "deepseek/")):
        model = f"openai/{model}"
    
    completion = client.chat.completions.create(
        model=model if model else DEFAULT_MODEL,
        messages=messages,
        temperature=temperature
    )
    
    return completion.choices[0].message.content

def getJSONResponseLLM(prompt: str, temperature: float = 0.7, model: Optional[str] = None) -> Dict[str, Any]:
    """
    Get a JSON response from the LLM.
    
    Args:
        prompt: The prompt to send to the LLM
        temperature: Sampling temperature
        model: The model to use (defaults to DEFAULT_MODEL if None)
        
    Returns:
        Parsed JSON response
    """
    # For the completeness check, we use the expert system prompt
    completeness_prompt = f"Application Description:\n\n{prompt}\n\nIs this description detailed enough for STRIDE threat modeling?"
    
    completion_text = get_llm_response(
        prompt=completeness_prompt,
        system_message=THREAT_MODELING_EXPERT_PROMPT,
        temperature=temperature,
        model=model if model else DEFAULT_MODEL
    )
    
    try:
        return json.loads(completion_text)
    except json.JSONDecodeError:
        # Try to find the json in the response
        try:
            # Look for JSON between triple backticks
            if "```json" in completion_text and "```" in completion_text:
                json_str = completion_text.split("```json")[1].split("```")[0].strip()
                return json.loads(json_str)
            # Try to find content that looks like JSON (starts with { and ends with })
            elif completion_text.strip().startswith("{") and completion_text.strip().endswith("}"):
                return json.loads(completion_text.strip())
            else:
                sys.exit(f"Error: LLM response is not valid JSON.\n\n{completion_text}")
        except (json.JSONDecodeError, IndexError):
            sys.exit(f"Error: LLM response is not valid JSON.\n\n{completion_text}")
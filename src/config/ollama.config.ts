/**
 * Ollama API configuration
 * 
 * This module loads configuration from environment variables or .env file
 */

import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export const OLLAMA_CONFIG = {
  // API base URL for Ollama service
  API_BASE_URL: process.env.OLLAMA_API_BASE_URL || 'http://localhost:11434',
  
  // Model configurations
  DEFAULT_MODEL: process.env.OLLAMA_DEFAULT_MODEL || 'codellama:7b',
  
  // Generation parameters
  DEFAULT_TEMPERATURE: process.env.OLLAMA_DEFAULT_TEMPERATURE || '0.7',
  DEFAULT_TOP_P: process.env.OLLAMA_DEFAULT_TOP_P || '0.9',
  DEFAULT_MAX_TOKENS: process.env.OLLAMA_DEFAULT_MAX_TOKENS || '2048',
};

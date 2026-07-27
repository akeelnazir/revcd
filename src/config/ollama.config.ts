import * as dotenv from 'dotenv';

dotenv.config();

export const OLLAMA_CONFIG = {
  API_BASE_URL: process.env.OLLAMA_API_BASE_URL || 'http://localhost:11434',

  DEFAULT_MODEL: process.env.OLLAMA_DEFAULT_MODEL || 'codellama:7b',

  DEFAULT_TEMPERATURE: process.env.OLLAMA_DEFAULT_TEMPERATURE || '0.7',
  DEFAULT_MAX_TOKENS: process.env.OLLAMA_DEFAULT_MAX_TOKENS || '2048',
  REQUEST_TIMEOUT: parseInt(process.env.OLLAMA_REQUEST_TIMEOUT || '60000'),

  MIN_REQUEST_INTERVAL: parseInt(process.env.OLLAMA_MIN_REQUEST_INTERVAL || '500'),
};

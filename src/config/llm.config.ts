import * as dotenv from 'dotenv';

dotenv.config();

export const LLM_CONFIG = {
  API_BASE_URL: process.env.LLM_API_BASE_URL || 'http://localhost:11434/v1',
  API_KEY: process.env.LLM_API_KEY || '',

  DEFAULT_MODEL: process.env.LLM_DEFAULT_MODEL || 'codellama:7b',

  DEFAULT_TEMPERATURE: process.env.LLM_DEFAULT_TEMPERATURE || '0.7',
  DEFAULT_TOP_P: process.env.LLM_DEFAULT_TOP_P || '0.9',
  DEFAULT_MAX_TOKENS: process.env.LLM_DEFAULT_MAX_TOKENS || '2048',
  REQUEST_TIMEOUT: parseInt(process.env.LLM_REQUEST_TIMEOUT || '60000'),

  MIN_REQUEST_INTERVAL: parseInt(process.env.LLM_MIN_REQUEST_INTERVAL || '500'),
};

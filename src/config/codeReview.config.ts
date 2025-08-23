/**
 * Code Review configuration
 * 
 * This module loads configuration from environment variables or .env file
 */

import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export const CODE_REVIEW_CONFIG = {
  // File extensions to include in code review
  FILE_EXTENSIONS: (process.env.CODE_FILE_EXTENSIONS || 'ts,js,py,rb').split(',').map(ext => ext.trim()),
};

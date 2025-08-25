import * as dotenv from 'dotenv';

dotenv.config();

export const CODE_REVIEW_CONFIG = {
  FILE_EXTENSIONS: (process.env.CODE_FILE_EXTENSIONS || 'ts,js,py,rb').split(',').map(ext => ext.trim()),
};

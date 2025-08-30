import axios from 'axios';
import path from 'path';
import { getLanguageFromExtension } from '../utils';
import { OLLAMA_CONFIG } from '../config';

export interface OllamaRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stop?: string[];
  };
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface CacheEntry {
  response: string;
  timestamp: number;
  model: string;
}

const SENSITIVE_PATTERNS = {
  API_KEY: /(['"](api[_-]?key|api[_-]?secret|app[_-]?key|app[_-]?secret|access[_-]?key|access[_-]?token|auth[_-]?token)['"]\s*[=:]\s*['"])[^'"]+(['"])/gi,
  PASSWORD: /(['"](password|passwd|pwd|secret)['"]\s*[=:]\s*['"])[^'"]+(['"])/gi,
  CONNECTION_STRING: /(connection[_-]?string|conn[_-]?str)\s*[=:]\s*['"][^'"]+['"]|mongodb(\+srv)?:\/\/[^\s]+|postgres(ql)?:\/\/[^\s]+|mysql:\/\/[^\s]+/gi,
  EMAIL: /([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})/gi,
  IP_ADDRESS: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
};

export interface OllamaServiceConfig {
  baseUrl?: string;
  defaultModel?: string;
  cacheTTL?: number;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  defaultTopP?: number;
  minRequestInterval?: number;
  requestTimeout?: number;
}

class OllamaService {
  private baseUrl: string;
  private abortController: AbortController | null = null;
  private defaultModel: string;
  private responseCache: Map<string, CacheEntry> = new Map();
  private cacheTTL: number = 1000 * 60 * 30;
  private defaultTemperature: number;
  private defaultMaxTokens: number;
  private defaultTopP: number;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 500;
  private requestTimeout: number = 60000;

  constructor(config?: OllamaServiceConfig) {
    this.baseUrl = config?.baseUrl || OLLAMA_CONFIG.API_BASE_URL;
    this.defaultModel = config?.defaultModel || OLLAMA_CONFIG.DEFAULT_MODEL;
    this.cacheTTL = config?.cacheTTL || 1000 * 60 * 30;
    this.defaultTemperature = config?.defaultTemperature || parseFloat(OLLAMA_CONFIG.DEFAULT_TEMPERATURE);
    this.defaultMaxTokens = config?.defaultMaxTokens || parseInt(OLLAMA_CONFIG.DEFAULT_MAX_TOKENS);
    this.defaultTopP = config?.defaultTopP || parseFloat(OLLAMA_CONFIG.DEFAULT_TOP_P);
    this.minRequestInterval = OLLAMA_CONFIG.MIN_REQUEST_INTERVAL || 500;
    this.requestTimeout = OLLAMA_CONFIG.REQUEST_TIMEOUT || 60000;
  }
  
  private generateCacheKey(codeContent: string, model: string, options?: any): string {
    const optionsStr = options ? JSON.stringify(options) : '';
    return `${model}:${codeContent.length}:${this.hashString(codeContent + optionsStr)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
  
  private sanitizeCodeContent(codeContent: string): string {
    if (codeContent === null || codeContent === undefined) {
      console.error('sanitizeCodeContent received null or undefined input');
      return '';
    }
    
    if (typeof codeContent !== 'string') {
      console.error(`sanitizeCodeContent received non-string input: ${typeof codeContent}`);
      try {
        codeContent = String(codeContent);
      } catch (error) {
        console.error('Failed to convert input to string:', error);
        return '';
      }
    }
    
    let sanitized = codeContent;
    
    Object.entries(SENSITIVE_PATTERNS).forEach(([type, pattern]) => {
      sanitized = sanitized.replace(pattern, (match) => {
        if (type === 'API_KEY' || type === 'PASSWORD' || type === 'CONNECTION_STRING') {
          return match.replace(/(['"'])[^'"']+(['"'])/, '$1[REDACTED]$2');
        } else if (type === 'EMAIL') {
          return match.replace(/([a-zA-Z0-9_\-\.]{3})[a-zA-Z0-9_\-\.]+@/, '$1***@');
        } else if (type === 'IP_ADDRESS') {
          return '[REDACTED_IP]';
        }
        return match;
      });
    });
    
    return sanitized;
  }
  
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.responseCache.entries()) {
      if (now - entry.timestamp > this.cacheTTL) {
        this.responseCache.delete(key);
      }
    }
  }
  
  private async applyRateLimiting(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.debug(`Rate limiting: waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
  
  private processResponseChunk(data: Partial<OllamaResponse>, onResponseText: (text: string) => void): void {
    if (typeof data.response === 'string') {
      onResponseText(data.response);
    } else if (data.done === true) {
      console.warn('Received completion signal but no valid response content');
    }
  }

  private getFileLanguageFromPath(filePath: string): string {
    if (!filePath) {
      return 'Unknown';
    }
    const fileBaseName = path.basename(filePath);
    const fileExtension = path.extname(fileBaseName).toLowerCase();
    
    return getLanguageFromExtension(fileExtension);
  }

  async reviewCode(
    codeContent: string, 
    filePath?: string, 
    model?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      timeout?: number;
      useCache?: boolean;
    }
  ): Promise<string | null> {
    if (!codeContent || codeContent.trim() === '') {
      console.error('Cannot review empty code content');
      return null;
    }

    this.cleanCache();

    try {
      const modelToUse = model || this.defaultModel;
      const useCache = options?.useCache !== false;
      
      if (!modelToUse) {
        console.error('No model specified and no default model configured');
        return null;
      }
      
      if (useCache) {
        const cacheKey = this.generateCacheKey(codeContent, modelToUse, options);
        const cachedResult = this.responseCache.get(cacheKey);
        
        if (cachedResult && (Date.now() - cachedResult.timestamp <= this.cacheTTL)) {
          console.log('Using cached code review result');
          return cachedResult.response;
        }
      }
      
      const sanitizedCode = this.sanitizeCodeContent(codeContent);
      
      const promptParts = [
        `You are a code reviewer and an expert in ${this.getFileLanguageFromPath(filePath || '')} programming language. Please review the following code:`,
        `
${sanitizedCode}
`,
        `Provide a concise code review focusing on:
1. Potential bugs or errors
2. Performance issues
3. Security concerns
4. Code style and best practices
5. Suggestions for improvement`
      ];
      
      const prompt = promptParts.join('\n');

      const requestBody: OllamaRequest = {
        model: modelToUse,
        prompt,
        stream: true, 
        options: {
          temperature: options?.temperature ?? this.defaultTemperature,
          max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
          top_p: options?.topP ?? this.defaultTopP
        }
      };

      this.abortController = new AbortController();
      
      const timeoutMs = options?.timeout || this.requestTimeout;
      
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => {
        console.warn(`Request timed out after ${timeoutMs}ms`);
        timeoutController.abort();
        this.abortController?.abort();
      }, timeoutMs);
      
      const combinedSignal = this.abortController.signal;

      await this.applyRateLimiting();
      
      try {
        const axiosResponse = await axios.post(
          `${this.baseUrl}/api/generate`,
          requestBody,
          {
            headers: {
              'Content-Type': 'application/json'
            },
            signal: combinedSignal,
            responseType: 'stream'
          }
        );

        if (axiosResponse.status !== 200) {
          console.error(`Error from Ollama API: ${axiosResponse.status} ${axiosResponse.statusText}`);
          return null;
        }

        if (!axiosResponse.data) {
          console.error('Response data is null');
          return null;
        }
        
        let fullResponse = '';
        let validResponseReceived = false;
        
        return new Promise<string | null>((resolve, reject) => {
          axiosResponse.data.on('data', (chunk: Buffer) => {
            const text = chunk.toString('utf-8');
            const lines = text.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
              try {
                const data = JSON.parse(line) as Partial<OllamaResponse>;
                
                this.processResponseChunk(data, (responseText) => {
                  validResponseReceived = true;
                  fullResponse += responseText;
                  process.stdout.write(responseText);
                });
              } catch (e) {
                console.error('Error parsing JSON line:', e, '\nProblematic line:', line);
              }
            }
          });
          
          axiosResponse.data.on('end', () => {
            if (validResponseReceived) {
              process.stdout.write('\n');
              
              if (useCache) {
                const cacheKey = this.generateCacheKey(codeContent, modelToUse, options);
                this.responseCache.set(cacheKey, {
                  response: fullResponse,
                  timestamp: Date.now(),
                  model: modelToUse
                });
              }
              
              resolve(fullResponse);
            } else {
              console.error('Received empty response from Ollama API');
              resolve(null);
            }
          });
          
          axiosResponse.data.on('error', (err: Error) => {
            console.error('Error reading stream:', err);
            reject(err);
          });
        });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      const e = error as Error;
      if (e && e.name === 'AbortError') {
        console.error('Request to Ollama API was aborted (timeout or manual cancellation)');
      } else {
        console.error('Error reviewing code with Ollama:', error);
        
        if (e && e instanceof Error) {
          console.error(`Error name: ${e.name}, Message: ${e.message}`);
          console.error(`Stack trace: ${e.stack}`);
        }
        
        if (e && e instanceof TypeError) {
          console.error('Type error occurred, possibly due to network issues or invalid API response format');
        } else if (e && e instanceof SyntaxError) {
          console.error('Syntax error occurred, possibly due to invalid JSON in API response');
        } else if (typeof e === 'object' && e !== null && 'code' in e) {
          const networkError = e as { code?: string };
          if (networkError.code === 'ECONNREFUSED') {
            console.error('Connection refused. Is the Ollama server running?');
          } else if (networkError.code === 'ENOTFOUND') {
            console.error('Host not found. Check the baseUrl configuration.');
          }
        }
      }
      return null;
    } finally {
      this.abortController = null;
    }
  }
}

export const ollamaService = new OllamaService();
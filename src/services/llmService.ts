import OpenAI from 'openai';
import { getFileLanguageFromPath } from '../utils';
import { LLM_CONFIG } from '../config';

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

export interface LLMServiceConfig {
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  cacheTTL?: number;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  defaultTopP?: number;
  minRequestInterval?: number;
  requestTimeout?: number;
}

class LLMService {
  private client: OpenAI;
  private baseUrl: string;
  private defaultModel: string;
  private responseCache: Map<string, CacheEntry> = new Map();
  private cacheTTL: number = 1000 * 60 * 30;
  private defaultTemperature: number;
  private defaultMaxTokens: number;
  private defaultTopP: number;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 500;
  private requestTimeout: number = 60000;
  private serverAvailable: boolean = false;

  constructor(config?: LLMServiceConfig) {
    this.baseUrl = config?.baseUrl || LLM_CONFIG.API_BASE_URL;
    const apiKey = config?.apiKey || LLM_CONFIG.API_KEY || 'not-needed';

    this.client = new OpenAI({
      apiKey,
      baseURL: this.baseUrl,
      timeout: config?.requestTimeout || parseInt(LLM_CONFIG.REQUEST_TIMEOUT.toString()),
      maxRetries: 0
    });

    this.defaultModel = config?.defaultModel || LLM_CONFIG.DEFAULT_MODEL;
    this.cacheTTL = config?.cacheTTL || 1000 * 60 * 30;
    this.defaultTemperature = config?.defaultTemperature || parseFloat(LLM_CONFIG.DEFAULT_TEMPERATURE);
    this.defaultMaxTokens = config?.defaultMaxTokens || parseInt(LLM_CONFIG.DEFAULT_MAX_TOKENS);
    this.defaultTopP = config?.defaultTopP || parseFloat(LLM_CONFIG.DEFAULT_TOP_P);
    this.minRequestInterval = LLM_CONFIG.MIN_REQUEST_INTERVAL || 500;
    this.requestTimeout = LLM_CONFIG.REQUEST_TIMEOUT || 60000;
    this.checkServerAvailability();
  }

  private async checkServerAvailability(): Promise<void> {
    try {
      this.serverAvailable = await this.isServerRunning();
      if (!this.serverAvailable) {
        console.warn('LLM server is not running or not accessible at', this.baseUrl);
      } else {
        console.log('Successfully connected to LLM server at', this.baseUrl);
      }
    } catch (error) {
      this.serverAvailable = false;
      console.error('Error checking LLM server availability:', error);
    }
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

  private async isServerRunning(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      console.error('LLM server check failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
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

      let cacheKey: string | null = null;
      if (useCache) {
        cacheKey = this.generateCacheKey(codeContent, modelToUse, options);
        const cachedResult = this.responseCache.get(cacheKey);

        if (cachedResult && (Date.now() - cachedResult.timestamp <= this.cacheTTL)) {
          console.log('Using cached code review result');
          return cachedResult.response;
        }
      }

      const sanitizedCode = this.sanitizeCodeContent(codeContent);

      const promptParts = [
        `You are a code reviewer and an expert in ${getFileLanguageFromPath(filePath || '')} programming language. Please review the code provided by the user:`,
        `Provide a detailed code review with the following structure:

### Review Status
At the beginning of your review, provide a status indicator:
- **FAILED**: Critical bugs, security vulnerabilities, or logic errors that must be resolved.
- **SUCCEEDED**: Production-ready with no critical issues.
- **OPTIONAL**: Functionally correct, with non-critical recommendations for improvement.

### Potential Issues
- Identify bugs, logic errors, and unhandled edge cases.
- Call out code smells (duplication, overly complex methods, etc.).
- Flag performance bottlenecks or inefficient algorithms.
- Highlight security vulnerabilities and unsafe practices.

### Code Quality
- Assess alignment with best practices and coding standards.
- Evaluate readability, maintainability, and structure.
- Review error handling and logging completeness.

### Recommendations
- Propose specific improvements with clear reasoning.
- Suggest a descriptive commit message for the changes.
- For each recommendation, present a side-by-side comparison using the format below to ease identification and implementation:`,
        `Line X-Y (original):
original code

Line X-Y (improved):
improved code`,
        `- If the code spans multiple components or complex interactions, include a Mermaid sequence diagram that visualizes the execution flow and data exchange between key functions or methods.`,
        `- Always reference precise line numbers (e.g., "Line 42-45") when discussing code. Present both original and improved code with line numbers in side-by-side code blocks to streamline finding issues and applying fixes.`
      ];

      const systemPrompt = promptParts.join('\n');

      await this.applyRateLimiting();

      try {
        if (!this.serverAvailable) {
          this.serverAvailable = await this.isServerRunning();
          if (!this.serverAvailable) {
            console.error('LLM server is not running or not accessible at', this.baseUrl);
            return null;
          }
        }

        const response = await this.client.chat.completions.create({
          model: modelToUse,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: sanitizedCode
            }
          ],
          temperature: options?.temperature ?? this.defaultTemperature,
          max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
          top_p: options?.topP ?? this.defaultTopP,
          stream: false
        });

        let fullResponse = '';

        if (response.choices && response.choices.length > 0 && response.choices[0].message.content) {
          fullResponse = response.choices[0].message.content;
          process.stdout.write(fullResponse);
          process.stdout.write('\n');

          if (useCache && cacheKey) {
            this.responseCache.set(cacheKey, {
              response: fullResponse,
              timestamp: Date.now(),
              model: modelToUse
            });
          }

          return fullResponse;
        } else {
          console.error('Received empty response from LLM API');
          return null;
        }
      } catch (error) {
        const e = error as Error;
        console.error('Error reviewing code with LLM:', error);

        if (e && e instanceof Error) {
          console.error(`Error name: ${e.name}, Message: ${e.message}`);
          console.error(`Stack trace: ${e.stack}`);
        }

        if (typeof e === 'object' && e !== null && 'code' in e) {
          const networkError = e as { code?: string };
          if (networkError.code === 'ECONNREFUSED') {
            console.error('Connection refused. Is the LLM server running?');
          } else if (networkError.code === 'ENOTFOUND') {
            console.error('Host not found. Check the baseUrl configuration.');
          }
        }

        return null;
      }
    } catch (error) {
      const e = error as Error;
      if (e && e instanceof Error) {
        console.error(`Error name: ${e.name}, Message: ${e.message}`);
      }
      return null;
    }
  }
}

export const llmService = new LLMService();

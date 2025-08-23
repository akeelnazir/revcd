import { OLLAMA_CONFIG } from '../config/ollama.config';

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
};

export interface OllamaResponse {
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaEmbeddingRequest {
  model: string;
  prompt: string;
}

export interface OllamaEmbeddingResponse {
  embedding: number[];
  model: string;
}

export interface CompletionOption {
  id: string;
  text: string;
  confidence: number;
  context: string;
}

class OllamaService {
  private baseUrl: string;
  private abortController: AbortController | null = null;
  private defaultModel: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.defaultModel = OLLAMA_CONFIG.DEFAULT_MODEL;
  }

  cancelRequest(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];

      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch {
      return [];
    }
  }

  /**
   * Sends code to Ollama for review
   * @param codeContent The code content to review
   * @param filePath Optional file path for context
   * @param model Optional model to use for review (defaults to config)
   * @returns Promise with the review response or null if error
   */
  async reviewCode(codeContent: string, filePath?: string, model?: string): Promise<string | null> {
    try {
      const modelToUse = model || this.defaultModel;
      
      // Create a prompt for code review
      let prompt = `Please review the following code`;
      if (filePath) {
        prompt += ` from file ${filePath}`;
      }
      prompt += `:

${codeContent}

`;
      prompt += `Provide a concise code review focusing on:
1. Potential bugs or errors
2. Performance issues
3. Security concerns
4. Code style and best practices
5. Suggestions for improvement`;

      const requestBody: OllamaRequest = {
        model: modelToUse,
        prompt: prompt,
        stream: true, // Enable streaming for better UX
        options: {
          temperature: parseFloat(OLLAMA_CONFIG.DEFAULT_TEMPERATURE),
          max_tokens: parseInt(OLLAMA_CONFIG.DEFAULT_MAX_TOKENS),
          top_p: parseFloat(OLLAMA_CONFIG.DEFAULT_TOP_P)
        }
      };

      this.abortController = new AbortController();
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        console.error(`Error from Ollama API: ${response.status} ${response.statusText}`);
        return null;
      }

      // Handle streaming response
      if (!response.body) {
        console.error('Response body is null');
        return null;
      }

      const reader = response.body.getReader();
      let fullResponse = '';
      
      try {
        // Process the stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Convert the chunk to text
          const chunk = new TextDecoder().decode(value);
          
          // Process each line (each JSON object)
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                // Append to the full response
                fullResponse += data.response;
                
                // Print the chunk to show progress (optional)
                process.stdout.write(data.response);
              }
            } catch (e) {
              // Skip invalid JSON
              console.error('Error parsing JSON line:', e);
            }
          }
        }
        
        // Add a newline at the end for better formatting
        process.stdout.write('\n');
        return fullResponse;
      } catch (error) {
        console.error('Error processing stream:', error);
        return fullResponse || null;
      }
    } catch (error) {
      console.error('Error reviewing code with Ollama:', error);
      return null;
    } finally {
      this.abortController = null;
    }
  }

}

export const ollamaService = new OllamaService(OLLAMA_CONFIG.API_BASE_URL);
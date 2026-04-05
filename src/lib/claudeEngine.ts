import { z } from 'zod';

// Maximum time to wait for the Claude API (60 seconds)
const TIMEOUT_MS = 60000;
const MAX_RETRIES = 3;

interface ClaudeOptions {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  system?: string;
  messages: any[];
}

export class APIExecutionError extends Error {
  constructor(message: string, public readonly attempt: number, public readonly isTimeout: boolean) {
    super(message);
    this.name = 'APIExecutionError';
  }
}

/**
 * Validates a parsed JSON object against a Zod schema.
 * Re-throws an error to trigger retry if invalid.
 */
function validateSchema<T>(data: unknown, schema: z.ZodSchema<T>): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Schema validation failed: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Fetch wrapper with timeout.
 */
async function fetchWithTimeout(resource: URL | RequestInfo, options?: RequestInit & { timeout?: number }) {
  const { timeout = TIMEOUT_MS } = options || {};
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Execute the Claude API call with retries and a 60s timeout.
 */
export async function runClaudeWithRetry<T>(
  apiKey: string,
  options: ClaudeOptions,
  schema: z.ZodSchema<T>,
  onProgress?: (msg: string) => void
): Promise<T> {
  let attempt = 0;
  let lastError: Error | null = null;
  
  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      if (onProgress) {
        onProgress(`분석 중... (시도 ${attempt}/${MAX_RETRIES})`);
      }
      
      const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: options.model || 'claude-3-5-sonnet-20241022',
          max_tokens: options.max_tokens || 4096,
          temperature: options.temperature || 0.2,
          system: options.system,
          messages: options.messages,
        }),
        timeout: TIMEOUT_MS
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const content = data.content[0]?.text || '';
      
      // Extract JSON if it contains markdown formatting
      let rawJson = content;
      const jsonMatch = content.match(/```(?:json)?([\s\S]*?)```/);
      if (jsonMatch) {
        rawJson = jsonMatch[1];
      }
      
      const parsed = JSON.parse(rawJson);
      
      // Zod validation. If it fails, an error is thrown and caught by retry block.
      return validateSchema<T>(parsed, schema);
      
    } catch (err: any) {
      lastError = err;
      const isTimeout = err.message.includes('timed out');
      console.error(`[ClaudeEngine] Attempt ${attempt} failed: ${err.message}`);
      
      // If we've hit max retries, throw final error
      if (attempt === MAX_RETRIES) {
        throw new APIExecutionError(err.message, attempt, isTimeout);
      }
      
      // Wait before retrying (exponential backoff 1s, 2s)
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  
  throw lastError;
}

/**
 * Compress context based on previous step overrides and AI output
 * This minimizes token usage by summarizing state before the next API call.
 */
export function buildContextMetadata(storeData: any, userOverrides: any): string {
  // Merge AI data with user overrides to create final context
  const contextData: Record<string, any> = {};
  
  // Basic serialization logic prioritising user overrides
  for (const [key, val] of Object.entries(storeData)) {
    if (val) {
      contextData[key] = { ...((val as any) || {}), ...(userOverrides[key] || {}) };
    }
  }

  return JSON.stringify(contextData, null, 2);
}

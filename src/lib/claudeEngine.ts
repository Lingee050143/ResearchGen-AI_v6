import { z } from 'zod';

// Maximum time to wait for the Claude API (1800 seconds)
const TIMEOUT_MS = 1800000;
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
  
  // 1. API 키 정제 (ISO-8859-1 통신 에러 방어)
  const sanitizedApiKey = apiKey.trim().replace(/[^\x20-\x7E]/g, '');

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
          'x-api-key': sanitizedApiKey,
          // 2. Anthropic 필수 헤더 2종 추가 (CORS 및 404 에러 방어)
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          // 3. 고유 모델명 강제 고정 (404 Not Found 에러 방어)
          model: options.model || 'claude-sonnet-4-6',
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
      
      // 4. JSON 파싱 전 Markdown 블록 제거 (파싱 에러 방어)
      const cleanJson = content.replace(/```(?:json)?([\s\S]*?)```/g, '$1').trim();
      
      const parsed = JSON.parse(cleanJson);
      
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

// ─── AI Competitor Generator ─────────────────────────────────────────────────

const CompetitorSchema = z.object({
  name: z.string(),
  description: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  links: z.object({
    playStore: z.string().optional(),
    appStore: z.string().optional(),
    web: z.string().optional(),
  }),
});

const CompetitorListSchema = z.object({
  competitors: z.array(CompetitorSchema).length(4),
});

export type Competitor = z.infer<typeof CompetitorSchema>;
export type CompetitorList = z.infer<typeof CompetitorListSchema>;

/**
 * Generate 4 AI-researched competitor profiles for the given idea.
 * Returns validated JSON via Zod, applying the same security/defensive logic
 * as runClaudeWithRetry (key sanitisation, required headers, model pin, markdown strip).
 */
export async function generateAICompetitors(
  idea: string,
  apiKey: string,
  onProgress?: (msg: string) => void
): Promise<CompetitorList> {
  const systemPrompt = `You are a startup market research expert.
Return ONLY valid JSON — no markdown fences, no extra text.`;

  const userPrompt = `Research 4 real or highly plausible competitors for the following startup idea:

"${idea}"

Return a JSON object that exactly matches this schema:
{
  "competitors": [
    {
      "name": "string — real company or realistic product name",
      "description": "string — one-sentence positioning",
      "pros": ["string", "string", "string"],
      "cons": ["string", "string", "string"],
      "links": {
        "playStore": "https://play.google.com/... (if applicable, otherwise omit)",
        "appStore": "https://apps.apple.com/... (if applicable, otherwise omit)",
        "web": "https://... (homepage URL, always include if the product has a website)"
      }
    }
  ]
}

Rules:
- Exactly 4 competitors.
- Each competitor must include at least one link (web, playStore, or appStore). Include all that apply.
- pros and cons must each have exactly 3 items.
- Output ONLY the JSON object. No markdown, no explanation.`;

  return runClaudeWithRetry<CompetitorList>(
    apiKey,
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    },
    CompetitorListSchema,
    onProgress
  );
}

// ─── AI Mock Review Generator ────────────────────────────────────────────────

const ReviewSchema = z.object({
  id: z.string(),
  content: z.string(),
  sentiment: z.enum(['Positive', 'Negative', 'Neutral']),
  rating: z.number().int().min(1).max(5),
});

const ReviewsResultSchema = z.object({
  reviews: z.array(ReviewSchema).length(8),
  sentimentStats: z.object({
    positive: z.number().int().min(0).max(100),
    negative: z.number().int().min(0).max(100),
    neutral: z.number().int().min(0).max(100),
  }),
  topComplaints: z.array(z.string()).min(1),
  praisedFeatures: z.array(z.string()).min(1),
  topicClusters: z.array(z.string()).min(1),
});

export type Review = z.infer<typeof ReviewSchema>;
export type ReviewsResult = z.infer<typeof ReviewsResultSchema>;

/**
 * Generate 8 realistic mock user reviews for the given idea, including
 * sentiment stats, top complaints, praised features, and topic clusters.
 * Reuses runClaudeWithRetry with all defensive logic applied.
 */
export async function generateAIReviews(
  idea: string,
  apiKey: string,
  onProgress?: (msg: string) => void
): Promise<ReviewsResult> {
  const systemPrompt = `You are a UX researcher specialising in user feedback analysis.
Return ONLY valid JSON — no markdown fences, no extra text.`;

  const userPrompt = `Generate 8 realistic mock user reviews for the following startup idea:

"${idea}"

Mix sentiments naturally: roughly 3 Positive, 3 Negative, 2 Neutral (adjust slightly for realism).
Each review must be 1–2 sentences and feel like an authentic app-store or product review.

Return a JSON object matching this EXACT schema (no extra keys):
{
  "reviews": [
    {
      "id": "r1",
      "content": "string — 1-2 sentence realistic user review",
      "sentiment": "Positive" | "Negative" | "Neutral",
      "rating": 1-5
    }
  ],
  "sentimentStats": {
    "positive": integer 0-100,
    "negative": integer 0-100,
    "neutral": integer 0-100
  },
  "topComplaints": ["string", "string", "string"],
  "praisedFeatures": ["string", "string", "string"],
  "topicClusters": ["string", "string", "string"]
}

Rules:
- Exactly 8 reviews (ids: r1–r8).
- sentimentStats values must sum to 100.
- topComplaints, praisedFeatures, topicClusters must each have exactly 3 items.
- Ratings: Positive → 4-5, Negative → 1-2, Neutral → 3.
- Output ONLY the JSON object. No markdown, no explanation.`;

  return runClaudeWithRetry<ReviewsResult>(
    apiKey,
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      temperature: 0.5,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    },
    ReviewsResultSchema,
    onProgress
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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

import type { Application } from 'express';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServingResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
    finish_reason?: string;
  }>;
  model?: string;
}

// ExecutionResult<T> is the discriminated union returned by AppKit's invoke()
type ExecutionResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; message: string };

interface ServingProxy {
  invoke(payload: {
    messages: Array<{ role: string; content: string }>;
    max_tokens?: number;
    temperature?: number;
  }): Promise<unknown>;
}

interface AppKitForAiReview {
  lakebase: {
    query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  };
  serving: (alias: string) => ServingProxy;
  server: {
    extend(fn: (app: Application) => void): void;
  };
}

export interface AiReviewResult {
  unique_id: string;
  contradictions: string[];
  suspicious_claims: string[];
  sparse_fields: string[];
  high_leverage: boolean;
  high_leverage_reason: string;
  overall_assessment: string;
  model_used: string;
  created_at: string;
  cached: boolean;
}

// ---------------------------------------------------------------------------
// SQL constants
// ---------------------------------------------------------------------------

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS review.ai_reviews (
    unique_id TEXT PRIMARY KEY,
    contradictions JSONB NOT NULL DEFAULT '[]'::jsonb,
    suspicious_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
    sparse_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    high_leverage BOOLEAN NOT NULL DEFAULT FALSE,
    high_leverage_reason TEXT NOT NULL DEFAULT '',
    overall_assessment TEXT NOT NULL DEFAULT '',
    model_used TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const GET_REVIEW_SQL = `
  SELECT unique_id, contradictions, suspicious_claims, sparse_fields,
         high_leverage, high_leverage_reason, overall_assessment, model_used, created_at
  FROM review.ai_reviews
  WHERE unique_id = $1
`;

const INSERT_REVIEW_SQL = `
  INSERT INTO review.ai_reviews (
    unique_id, contradictions, suspicious_claims, sparse_fields,
    high_leverage, high_leverage_reason, overall_assessment, model_used
  )
  VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, $7, $8)
  ON CONFLICT (unique_id) DO NOTHING
  RETURNING unique_id, contradictions, suspicious_claims, sparse_fields,
            high_leverage, high_leverage_reason, overall_assessment, model_used, created_at
`;

// ---------------------------------------------------------------------------
// AI prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a meticulous data quality auditor for healthcare facility records used in medical supply chain planning.

Analyse the JSON record provided and return ONLY a valid JSON object — no markdown, no backticks, no extra text.

Required shape:
{
  "contradictions": string[],      // field combinations that logically contradict each other (e.g. "500-bed capacity but only 1 doctor listed")
  "suspicious_claims": string[],   // values that appear implausible, fabricated, or suspiciously copied (e.g. "year_established listed as 2099")
  "sparse_fields": string[],       // fields that are present but too vague, generic, or insufficient to be actionable (e.g. "description is a single generic sentence")
  "high_leverage": boolean,        // true if this record is worth prioritising for human enrichment
  "high_leverage_reason": string,  // one sentence explaining why (or "" if high_leverage is false)
  "overall_assessment": string     // 1-2 sentences summarising the record's overall data readiness for downstream use
}

Rules:
- Each item in the string arrays must be specific and actionable, not generic.
- high_leverage = true when the facility is a major hospital, has large capacity (>100 beds), serves an urban area, or has many specialist capabilities.
- Return [] for arrays with no issues and "" for empty strings.
- NEVER wrap your response in markdown code fences.`;

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const AiReviewRequestSchema = z.object({
  facility: z.unknown(),
});

const AiAnalysisSchema = z.object({
  contradictions: z.array(z.string()).catch([]),
  suspicious_claims: z.array(z.string()).catch([]),
  sparse_fields: z.array(z.string()).catch([]),
  high_leverage: z.boolean().catch(false),
  high_leverage_reason: z.string().catch(''),
  overall_assessment: z.string().catch(''),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function coerceBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  if (typeof value === 'number') return value !== 0;
  return false;
}

function coerceString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return fallback;
}

function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    } catch {
      return [];
    }
  }
  return [];
}

function coerceTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return value;
  return new Date(0).toISOString();
}

function mapReviewRow(row: Record<string, unknown>, cached: boolean): AiReviewResult {
  return {
    unique_id: coerceString(row.unique_id),
    contradictions: coerceStringArray(row.contradictions),
    suspicious_claims: coerceStringArray(row.suspicious_claims),
    sparse_fields: coerceStringArray(row.sparse_fields),
    high_leverage: coerceBoolean(row.high_leverage),
    high_leverage_reason: coerceString(row.high_leverage_reason),
    overall_assessment: coerceString(row.overall_assessment),
    model_used: coerceString(row.model_used),
    created_at: coerceTimestamp(row.created_at),
    cached,
  };
}

function extractLlmContent(response: ServingResponse): string {
  return response.choices?.[0]?.message?.content ?? '';
}

function parseAiAnalysis(rawContent: string): z.infer<typeof AiAnalysisSchema> {
  const trimmed = rawContent.trim();
  const jsonMatch = /\{[\s\S]*\}/.exec(trimmed);
  const jsonString = jsonMatch ? jsonMatch[0] : trimmed;
  try {
    const parsed = JSON.parse(jsonString) as unknown;
    return AiAnalysisSchema.parse(parsed);
  } catch {
    return AiAnalysisSchema.parse({});
  }
}

// ---------------------------------------------------------------------------
// Route setup
// ---------------------------------------------------------------------------

export async function setupAiReviewRoutes(appkit: AppKitForAiReview): Promise<void> {
  try {
    await appkit.lakebase.query(CREATE_TABLE_SQL);
    console.log('[ai-review] review.ai_reviews table ready');
  } catch (error) {
    console.warn('[ai-review] Table setup failed:', getErrorMessage(error));
    console.warn('[ai-review] Routes will still be registered');
  }

  appkit.server.extend((app) => {
    /**
     * POST /api/ai-review/:uniqueId
     *
     * Body: { facility: Record<string, unknown> }
     *
     * 1. Check Lakebase cache — return immediately if found.
     * 2. Call Model Serving LLM to analyse the facility record.
     * 3. Cache result in Lakebase.
     * 4. Return structured JSON.
     */
    app.post('/api/ai-review/:uniqueId', async (req, res) => {
      try {
        const uniqueId = typeof req.params.uniqueId === 'string' ? req.params.uniqueId.trim() : '';
        if (!uniqueId) {
          res.status(400).json({ error: 'Invalid uniqueId' });
          return;
        }

        // Validate request body
        const bodyParsed = AiReviewRequestSchema.safeParse(req.body);
        if (!bodyParsed.success) {
          res.status(400).json({ error: 'Request body must include a facility object' });
          return;
        }

        // ── Cache check ─────────────────────────────────────────────────────
        try {
          const cached = await appkit.lakebase.query(GET_REVIEW_SQL, [uniqueId]);
          if (cached.rows.length > 0) {
            res.json(mapReviewRow(cached.rows[0], true));
            return;
          }
        } catch (cacheError) {
          console.warn('[ai-review] Cache lookup failed (continuing):', getErrorMessage(cacheError));
        }

        // ── Serving endpoint check ───────────────────────────────────────────
        if (!process.env.DATABRICKS_SERVING_ENDPOINT_NAME) {
          res.status(503).json({
            error: 'AI review service is not configured. Set DATABRICKS_SERVING_ENDPOINT_NAME in your environment.',
          });
          return;
        }

        // ── Call LLM ─────────────────────────────────────────────────────────
        const facilityJson = JSON.stringify(bodyParsed.data.facility, null, 2);
        const userMessage = `Analyse this healthcare facility record:\n\n${facilityJson}`;

        let servingResult: ServingResponse;
        try {
          const raw = await appkit.serving('default').invoke({
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userMessage },
            ],
            max_tokens: 1024,
            temperature: 0,
          });

          // AppKit wraps the response in ExecutionResult<T> = { ok: true, data: T }
          // or { ok: false, status, message } on failure.
          if (raw !== null && typeof raw === 'object' && 'ok' in raw) {
            const result = raw as ExecutionResult;
            if (!result.ok) {
              console.error('[ai-review] Serving execution failed:', result.message);
              res.status(502).json({ error: `AI review failed: ${result.message}` });
              return;
            }
            servingResult = result.data as ServingResponse;
          } else if (raw === null || raw === undefined) {
            console.error('[ai-review] Serving plugin returned null — check server logs');
            res.status(502).json({ error: 'AI review failed: model endpoint returned no response' });
            return;
          } else {
            servingResult = raw as ServingResponse;
          }
        } catch (llmError) {
          console.error('[ai-review] LLM call failed:', getErrorMessage(llmError));
          res.status(502).json({ error: `AI review failed: ${getErrorMessage(llmError)}` });
          return;
        }

        const rawContent = extractLlmContent(servingResult);
        const modelUsed = servingResult.model ?? process.env.DATABRICKS_SERVING_ENDPOINT_NAME ?? 'unknown';

        if (!rawContent) {
          res.status(502).json({ error: 'AI review failed: empty response from model' });
          return;
        }

        const analysis = parseAiAnalysis(rawContent);

        // ── Persist to Lakebase ───────────────────────────────────────────────
        let savedRow: AiReviewResult;
        try {
          const insertResult = await appkit.lakebase.query(INSERT_REVIEW_SQL, [
            uniqueId,
            JSON.stringify(analysis.contradictions),
            JSON.stringify(analysis.suspicious_claims),
            JSON.stringify(analysis.sparse_fields),
            analysis.high_leverage,
            analysis.high_leverage_reason,
            analysis.overall_assessment,
            modelUsed,
          ]);

          if (insertResult.rows.length > 0) {
            savedRow = mapReviewRow(insertResult.rows[0], false);
          } else {
            // ON CONFLICT DO NOTHING means someone else inserted first — fetch it
            const refetch = await appkit.lakebase.query(GET_REVIEW_SQL, [uniqueId]);
            savedRow = refetch.rows.length > 0
              ? mapReviewRow(refetch.rows[0], true)
              : {
                  unique_id: uniqueId,
                  ...analysis,
                  model_used: modelUsed,
                  created_at: new Date().toISOString(),
                  cached: false,
                };
          }
        } catch (persistError) {
          console.error('[ai-review] Failed to persist review:', getErrorMessage(persistError));
          // Return the result even if caching failed
          savedRow = {
            unique_id: uniqueId,
            ...analysis,
            model_used: modelUsed,
            created_at: new Date().toISOString(),
            cached: false,
          };
        }

        res.json(savedRow);
      } catch (error) {
        console.error('[ai-review] Unexpected error:', getErrorMessage(error));
        res.status(500).json({ error: 'Internal server error during AI review' });
      }
    });
  });
}

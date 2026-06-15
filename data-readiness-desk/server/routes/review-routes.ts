import type { Application } from 'express';
import { z } from 'zod';

interface AppKitWithLakebase {
  lakebase: {
    query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  };
  server: {
    extend(fn: (app: Application) => void): void;
  };
}

const ReviewStatusSchema = z.enum(['pending', 'approved', 'flagged', 'rejected']);
const UpdateDecisionBodySchema = z.object({
  status: ReviewStatusSchema,
  reviewer_notes: z.string(),
  shortlisted: z.boolean(),
});

type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

interface DecisionRecord {
  unique_id: string;
  status: ReviewStatus;
  reviewer_notes: string;
  shortlisted: boolean;
  reviewed_by: string;
  updated_at: string;
}

interface ReviewStats {
  total_reviewed: number;
  approved_count: number;
  flagged_count: number;
  rejected_count: number;
  shortlisted_count: number;
}

const CREATE_SCHEMA_SQL = 'CREATE SCHEMA IF NOT EXISTS review';
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS review.decisions (
    unique_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewer_notes TEXT NOT NULL DEFAULT '',
    shortlisted BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const LIST_DECISIONS_SQL = `
  SELECT unique_id, status, reviewer_notes, shortlisted, reviewed_by, updated_at
  FROM review.decisions
  ORDER BY updated_at DESC
`;

const GET_DECISION_SQL = `
  SELECT unique_id, status, reviewer_notes, shortlisted, reviewed_by, updated_at
  FROM review.decisions
  WHERE unique_id = $1
`;

const UPSERT_DECISION_SQL = `
  INSERT INTO review.decisions (
    unique_id,
    status,
    reviewer_notes,
    shortlisted,
    reviewed_by,
    updated_at
  )
  VALUES ($1, $2, $3, $4, $5, NOW())
  ON CONFLICT (unique_id) DO UPDATE SET
    status = EXCLUDED.status,
    reviewer_notes = EXCLUDED.reviewer_notes,
    shortlisted = EXCLUDED.shortlisted,
    reviewed_by = EXCLUDED.reviewed_by,
    updated_at = NOW()
  RETURNING unique_id, status, reviewer_notes, shortlisted, reviewed_by, updated_at
`;

const REVIEW_STATS_SQL = `
  SELECT
    COUNT(*) FILTER (WHERE status <> 'pending') AS total_reviewed,
    COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
    COUNT(*) FILTER (WHERE status = 'flagged') AS flagged_count,
    COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
    COUNT(*) FILTER (WHERE shortlisted = TRUE) AS shortlisted_count
  FROM review.decisions
`;

const DEFAULT_UPDATED_AT = new Date(0).toISOString();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function coerceString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}

function coerceBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return false;
}

function coerceNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function coerceTimestamp(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  return DEFAULT_UPDATED_AT;
}

function normalizeStatus(value: unknown): ReviewStatus {
  const parsed = ReviewStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : 'pending';
}

function createDefaultDecision(uniqueId: string): DecisionRecord {
  return {
    unique_id: uniqueId,
    status: 'pending',
    reviewer_notes: '',
    shortlisted: false,
    reviewed_by: '',
    updated_at: DEFAULT_UPDATED_AT,
  };
}

function mapDecisionRow(row: Record<string, unknown>): DecisionRecord {
  return {
    unique_id: coerceString(row.unique_id),
    status: normalizeStatus(row.status),
    reviewer_notes: coerceString(row.reviewer_notes),
    shortlisted: coerceBoolean(row.shortlisted),
    reviewed_by: coerceString(row.reviewed_by),
    updated_at: coerceTimestamp(row.updated_at),
  };
}

function mapStatsRow(row?: Record<string, unknown>): ReviewStats {
  return {
    total_reviewed: coerceNumber(row?.total_reviewed),
    approved_count: coerceNumber(row?.approved_count),
    flagged_count: coerceNumber(row?.flagged_count),
    rejected_count: coerceNumber(row?.rejected_count),
    shortlisted_count: coerceNumber(row?.shortlisted_count),
  };
}

function getUniqueIdParam(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export async function setupReviewRoutes(appkit: AppKitWithLakebase) {
  try {
    await appkit.lakebase.query(CREATE_SCHEMA_SQL);
    await appkit.lakebase.query(CREATE_TABLE_SQL);
    console.log('[review] review.decisions schema ready');
  } catch (error) {
    console.warn('[review] Database setup failed:', getErrorMessage(error));
    console.warn('[review] Routes will still be registered');
  }

  appkit.server.extend((app) => {
    app.get('/api/review/decisions', async (_req, res) => {
      try {
        const result = await appkit.lakebase.query(LIST_DECISIONS_SQL);
        res.json(result.rows.map(mapDecisionRow));
      } catch (error) {
        console.error('Failed to list review decisions:', error);
        res.status(500).json({ error: 'Failed to list review decisions' });
      }
    });

    app.get('/api/review/decisions/:uniqueId', async (req, res) => {
      try {
        const uniqueId = getUniqueIdParam(req.params.uniqueId);
        if (!uniqueId) {
          res.status(400).json({ error: 'Invalid uniqueId' });
          return;
        }

        const result = await appkit.lakebase.query(GET_DECISION_SQL, [uniqueId]);
        if (result.rows.length === 0) {
          res.json(createDefaultDecision(uniqueId));
          return;
        }

        res.json(mapDecisionRow(result.rows[0]));
      } catch (error) {
        console.error('Failed to fetch review decision:', error);
        res.status(500).json({ error: 'Failed to fetch review decision' });
      }
    });

    app.put('/api/review/decisions/:uniqueId', async (req, res) => {
      try {
        const uniqueId = getUniqueIdParam(req.params.uniqueId);
        if (!uniqueId) {
          res.status(400).json({ error: 'Invalid uniqueId' });
          return;
        }

        const parsedBody = UpdateDecisionBodySchema.safeParse(req.body);
        if (!parsedBody.success) {
          res.status(400).json({ error: 'Invalid review decision payload' });
          return;
        }

        const reviewer = req.header('x-forwarded-email') ?? 'local-dev';
        const { status, reviewer_notes, shortlisted } = parsedBody.data;

        const result = await appkit.lakebase.query(UPSERT_DECISION_SQL, [
          uniqueId,
          status,
          reviewer_notes.trim(),
          shortlisted,
          reviewer,
        ]);

        res.json(mapDecisionRow(result.rows[0] ?? createDefaultDecision(uniqueId)));
      } catch (error) {
        console.error('Failed to save review decision:', error);
        res.status(500).json({ error: 'Failed to save review decision' });
      }
    });

    app.get('/api/review/stats', async (_req, res) => {
      try {
        const result = await appkit.lakebase.query(REVIEW_STATS_SQL);
        res.json(mapStatsRow(result.rows[0]));
      } catch (error) {
        console.error('Failed to fetch review stats:', error);
        res.status(500).json({ error: 'Failed to fetch review stats' });
      }
    });
  });
}

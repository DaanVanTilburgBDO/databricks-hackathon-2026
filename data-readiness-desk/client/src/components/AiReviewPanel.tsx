import { useEffect, useState } from 'react';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@databricks/appkit-ui/react';
import { AlertTriangle, BadgeCheck, Bot, ShieldAlert, Sparkles } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AiReviewResult {
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

interface AiReviewPanelProps {
  /** Facility unique ID — used as the cache key and route param. */
  uniqueId: string;
  /** Full facility record — sent to the AI for analysis (only on cache miss). */
  facility: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FindingsSection({
  icon,
  title,
  items,
  badgeClass,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  badgeClass: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-semibold text-[#0B2026]">{title}</p>
      </div>
      <ul className="space-y-1.5 pl-1">
        {items.map((item) => (
          <li key={`${title}-${item}`} className="flex items-start gap-2">
            <Badge className={`mt-0.5 shrink-0 border px-2 py-0.5 text-xs ${badgeClass}`}>
              {items.indexOf(item) + 1}
            </Badge>
            <span className="text-sm leading-6 text-[#41545A]">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <Card className="border-[#E7DED2] bg-white shadow-sm">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="ml-auto h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-10 w-full rounded-2xl" />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AiReviewPanel({ uniqueId, facility }: AiReviewPanelProps) {
  const [review, setReview] = useState<AiReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    async function fetchReview() {
      setLoading(true);
      setError(null);
      setReview(null);

      try {
        const response = await fetch(`/api/ai-review/${encodeURIComponent(uniqueId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ facility }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => ({ error: 'Request failed' }))) as {
            error?: string;
          };
          throw new Error(body.error ?? `AI review failed (${response.status})`);
        }

        const data = (await response.json()) as AiReviewResult;
        setReview(data);
      } catch (err) {
        if (!abortController.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load AI review');
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void fetchReview();
    return () => abortController.abort();
  }, [uniqueId, facility]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <Card className="border-[#E7DED2] bg-white shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-[#5D6B70]" />
            <CardTitle className="text-xl text-[#0B2026]">AI Record Review</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-[#F4B4AE] bg-[#FFF4F2] px-4 py-3 text-sm text-[#9B2C2C]">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!review) return null;

  const hasFindings =
    review.contradictions.length > 0 ||
    review.suspicious_claims.length > 0 ||
    review.sparse_fields.length > 0;

  return (
    <Card className="border-[#E7DED2] bg-white shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-[#5D6B70]" />
            <CardTitle className="text-xl text-[#0B2026]">AI Record Review</CardTitle>
          </div>
          <div className="flex flex-wrap gap-2">
            {review.high_leverage && (
              <Badge className="border border-[#B8DEC7] bg-[#F4FBF6] px-3 py-1 text-xs font-semibold text-[#2F855A]">
                <Sparkles className="mr-1 h-3 w-3" />
                High Leverage
              </Badge>
            )}
            <Badge className="border border-[#D8CDC0] bg-[#F8F4EF] px-3 py-1 text-xs text-[#5D6B70]">
              {review.cached ? 'Cached' : 'Fresh analysis'}
            </Badge>
          </div>
        </div>
        <CardDescription>
          Automated quality check for human reviewer guidance — contradictions, suspicious values,
          and enrichment priority.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* High-leverage callout */}
        {review.high_leverage && review.high_leverage_reason && (
          <div className="flex gap-3 rounded-2xl border border-[#B8DEC7] bg-[#F4FBF6] px-4 py-3">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2F855A]" />
            <p className="text-sm text-[#2F855A]">
              <span className="font-semibold">Priority enrichment target: </span>
              {review.high_leverage_reason}
            </p>
          </div>
        )}

        {/* No issues found */}
        {!hasFindings && (
          <div className="flex gap-3 rounded-2xl border border-[#B8DEC7] bg-[#F4FBF6] px-4 py-3">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2F855A]" />
            <p className="text-sm text-[#41795D]">
              No contradictions, suspicious claims, or sparse fields detected.
            </p>
          </div>
        )}

        {/* Contradictions */}
        <FindingsSection
          icon={<ShieldAlert className="h-4 w-4 text-[#C53030]" />}
          title="Contradictions"
          items={review.contradictions}
          badgeClass="border-[#F4B4AE] bg-[#FFF2F0] text-[#C53030]"
        />

        {/* Suspicious claims */}
        <FindingsSection
          icon={<AlertTriangle className="h-4 w-4 text-[#B7791F]" />}
          title="Suspicious Claims"
          items={review.suspicious_claims}
          badgeClass="border-[#F2D39A] bg-[#FFF8EA] text-[#B7791F]"
        />

        {/* Sparse fields */}
        <FindingsSection
          icon={<AlertTriangle className="h-4 w-4 text-[#5D6B70]" />}
          title="Sparse or Vague Fields"
          items={review.sparse_fields}
          badgeClass="border-[#D8CDC0] bg-[#F8F4EF] text-[#41545A]"
        />

        {/* Overall assessment */}
        {review.overall_assessment && (
          <div className="rounded-2xl border border-[#E7DED2] bg-[#FAF8F4] px-4 py-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#5D6B70]">
              Overall Assessment
            </p>
            <p className="text-sm leading-6 text-[#41545A]">{review.overall_assessment}</p>
          </div>
        )}

        {/* Footer */}
        <p className="text-right text-xs text-[#B8A99A]">
          Reviewed by AI · {new Date(review.created_at).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

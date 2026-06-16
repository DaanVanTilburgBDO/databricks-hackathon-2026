import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { AiReviewPanel } from '../components/AiReviewPanel';
import { sql } from '@databricks/appkit-ui/js';
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Skeleton,
  Switch,
  Textarea,
  useAnalyticsQuery,
} from '@databricks/appkit-ui/react';
import { toast } from 'sonner';

export type ReviewStatus = 'pending' | 'approved' | 'flagged' | 'rejected';

export interface Decision {
  unique_id: string;
  status: ReviewStatus;
  reviewer_notes: string;
  shortlisted: boolean;
  reviewed_by: string;
  updated_at: string;
}

const STATUS_OPTIONS: Array<{ value: ReviewStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'rejected', label: 'Rejected' },
];

function isBlank(value: unknown): boolean {
  return !String(value ?? '').trim();
}

function parseJsonArray(value: unknown): string[] {
  const trimmedValue = String(value ?? '').trim();
  if (!trimmedValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(trimmedValue) as unknown;
    const values = Array.isArray(parsedValue) ? parsedValue : [parsedValue];

    return [...new Set(
      values
        .map((item) => (typeof item === 'string' ? item : String(item ?? '')))
        .map((item) => item.trim())
        .filter(Boolean),
    )];
  } catch {
    return [...new Set(
      trimmedValue
        .split(/[\n,;|]/)
        .map((item) => item.trim())
        .filter(Boolean),
    )];
  }
}

function getStatusButtonClass(status: ReviewStatus, activeStatus: ReviewStatus): string {
  const isActive = status === activeStatus;

  if (status === 'approved') {
    return isActive
      ? 'border-[#2F855A] bg-[#2F855A] text-white'
      : 'border-[#B8DEC7] bg-[#F4FBF6] text-[#2F855A]';
  }

  if (status === 'flagged') {
    return isActive
      ? 'border-[#B7791F] bg-[#B7791F] text-white'
      : 'border-[#F2D39A] bg-[#FFF8EA] text-[#B7791F]';
  }

  if (status === 'rejected') {
    return isActive
      ? 'border-[#C53030] bg-[#C53030] text-white'
      : 'border-[#F4B4AE] bg-[#FFF2F0] text-[#C53030]';
  }

  return isActive
    ? 'border-[#41545A] bg-[#41545A] text-white'
    : 'border-[#D8CDC0] bg-[#F8F4EF] text-[#41545A]';
}

function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? 'Not yet reviewed' : parsed.toLocaleString();
}

function formatValue(value: unknown, fallback = 'Not provided'): string {
  const s = String(value ?? '').trim();
  return s || fallback;
}

function EvidenceSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="border-[#E7DED2] bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl text-[#0B2026]">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Badge
              key={`${title}-${item}`}
              className="border border-[#D8CDC0] bg-[#F8F4EF] px-3 py-1 text-sm text-[#41545A]"
            >
              {item}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function RecordDetailPage() {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const resolvedUniqueId = useMemo(
    () => (uniqueId ? decodeURIComponent(uniqueId) : undefined),
    [uniqueId],
  );
  const facilityParams = useMemo(
    () => ({ facility_id: sql.string(resolvedUniqueId ?? '') }),
    [resolvedUniqueId],
  );
  const queryOptions = useMemo(
    () => ({ autoStart: Boolean(resolvedUniqueId) }),
    [resolvedUniqueId],
  );
  const {
    data: facilityData,
    loading: facilityLoading,
    error: facilityError,
  } = useAnalyticsQuery('facility_detail', facilityParams, queryOptions);

  const [decision, setDecision] = useState<Decision | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(true);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const [notes, setNotes] = useState('');
  const [shortlisted, setShortlisted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!resolvedUniqueId) {
      setDecision(null);
      setDecisionLoading(false);
      return;
    }

    const abortController = new AbortController();

    async function loadDecision() {
      const currentUniqueId = resolvedUniqueId;
      if (!currentUniqueId) {
        return;
      }

      setDecisionLoading(true);
      setDecisionError(null);

      try {
        const response = await fetch(`/api/review/decisions/${encodeURIComponent(currentUniqueId)}`, {
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to load review decision (${response.status})`);
        }

        const payload = (await response.json()) as Decision;
        setDecision(payload);
        setStatus(payload.status);
        setNotes(payload.reviewer_notes);
        setShortlisted(payload.shortlisted);
      } catch (errorValue) {
        if (abortController.signal.aborted) {
          return;
        }

        setDecisionError(
          errorValue instanceof Error ? errorValue.message : 'Failed to load review decision',
        );
      } finally {
        if (!abortController.signal.aborted) {
          setDecisionLoading(false);
        }
      }
    }

    void loadDecision();

    return () => abortController.abort();
  }, [resolvedUniqueId]);

  const facility = facilityData?.[0];
  const capabilities = useMemo(() => parseJsonArray(facility?.capability ?? ''), [facility?.capability]);
  const procedures = useMemo(
    () => parseJsonArray(facility?.procedure_text ?? ''),
    [facility?.procedure_text],
  );
  const equipment = useMemo(() => parseJsonArray(facility?.equipment ?? ''), [facility?.equipment]);
  const specialties = useMemo(
    () => parseJsonArray(facility?.specialties ?? ''),
    [facility?.specialties],
  );

  const dataQualityIssues = useMemo(() => {
    if (!facility) {
      return [];
    }

    const issues: string[] = [];

    if (isBlank(facility.description)) {
      issues.push('Missing description');
    }
    if (isBlank(facility.number_doctors)) {
      issues.push('Missing doctor count');
    }
    if (isBlank(facility.capacity)) {
      issues.push('Missing capacity');
    }
    if (isBlank(facility.year_established)) {
      issues.push('Missing year established');
    }
    if (specialties.length === 0) {
      issues.push('Missing specialties');
    }

    return issues;
  }, [facility, specialties.length]);

  async function saveDecision() {
    const currentUniqueId = resolvedUniqueId;
    if (!currentUniqueId) {
      return;
    }

    setSaving(true);
    setDecisionError(null);

    try {
      const response = await fetch(`/api/review/decisions/${encodeURIComponent(currentUniqueId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          reviewer_notes: notes,
          shortlisted,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save review decision (${response.status})`);
      }

      const payload = (await response.json()) as Decision;
      setDecision(payload);
      setStatus(payload.status);
      setNotes(payload.reviewer_notes);
      setShortlisted(payload.shortlisted);
      toast('Review saved', {
        description: payload.shortlisted
          ? 'Decision captured and facility kept on the shortlist.'
          : 'Reviewer decision updated successfully.',
      });
    } catch (errorValue) {
      setDecisionError(
        errorValue instanceof Error ? errorValue.message : 'Failed to save review decision',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!resolvedUniqueId) {
    return (
      <div className="rounded-3xl border border-[#F4B4AE] bg-[#FFF4F2] px-6 py-10 text-center text-[#9B2C2C] shadow-sm">
        A valid facility identifier is required to review a record.
      </div>
    );
  }

  if (facilityLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (facilityError) {
    return (
      <div className="rounded-3xl border border-[#F4B4AE] bg-[#FFF4F2] px-6 py-10 text-center text-[#9B2C2C] shadow-sm">
        Failed to load facility details: {facilityError}
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="rounded-3xl border border-dashed border-[#D8CDC0] bg-white px-6 py-10 text-center text-[#5D6B70] shadow-sm">
        No facility record was found for <span className="font-semibold">{resolvedUniqueId}</span>.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
      <div className="space-y-6 lg:col-span-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <Link to="/" className="text-sm text-[#5D6B70] hover:text-[#FF3621]">
                Dashboard
              </Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <Link to="/queue" className="text-sm text-[#5D6B70] hover:text-[#FF3621]">
                Review Queue
              </Link>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{String(facility.name ?? '')}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Card className="border-[#E7DED2] bg-white shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <CardTitle className="text-3xl tracking-tight text-[#0B2026]">
                  {String(facility.name ?? '')}
                </CardTitle>
                <CardDescription>
                  {[facility.city, facility.state, facility.postcode].filter((v) => String(v ?? '').trim()).join(', ')}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="border border-[#D8CDC0] bg-[#F8F4EF] text-[#41545A]">
                  {String(facility.facility_type ?? '')}
                </Badge>
                <Badge className="border border-[#D8CDC0] bg-[#F8F4EF] text-[#41545A]">
                  {String(facility.organization_type ?? '')}
                </Badge>
                <Badge className="border border-[#D8CDC0] bg-[#F8F4EF] text-[#41545A]">
                  {String(facility.operator_type ?? '')}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5D6B70]">
                Address
              </p>
              <p className="mt-2 text-sm leading-6 text-[#41545A]">
                {[facility.address_line1, facility.address_line2, facility.address_line3]
                  .filter((v) => String(v ?? '').trim())
                  .join(', ') || 'Address not provided'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5D6B70]">
                Contact
              </p>
              <p className="mt-2 text-sm leading-6 text-[#41545A]">
                {formatValue(facility.phone_numbers)}
                <br />
                {formatValue(facility.email)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5D6B70]">
                Capacity & Staffing
              </p>
              <p className="mt-2 text-sm leading-6 text-[#41545A]">
                Capacity: {formatValue(facility.capacity)}
                <br />
                Doctors: {formatValue(facility.number_doctors)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5D6B70]">
                Established & Links
              </p>
              <p className="mt-2 text-sm leading-6 text-[#41545A]">
                Year established: {formatValue(facility.year_established)}
                <br />
                Website: {formatValue(facility.websites)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#E7DED2] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-[#0B2026]">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-7 text-[#41545A]">
              {String(facility.description ?? '').trim()
                ? facility.description
                : 'No description available'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#E7DED2] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl text-[#0B2026]">Data Quality Issues</CardTitle>
            <CardDescription>Fields that still need enrichment before the record is trusted downstream.</CardDescription>
          </CardHeader>
          <CardContent>
            {dataQualityIssues.length === 0 ? (
              <p className="text-sm text-[#41795D]">No major completeness issues detected for this record.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {dataQualityIssues.map((issue) => (
                  <Badge
                    key={issue}
                    className="border border-[#F4B4AE] bg-[#FFF2F0] px-3 py-1 text-sm text-[#C53030]"
                  >
                    {issue}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {resolvedUniqueId && (
          <AiReviewPanel
            uniqueId={resolvedUniqueId}
            facility={facility as Record<string, unknown>}
          />
        )}

        <EvidenceSection title="Capabilities" items={capabilities} />
        <EvidenceSection title="Procedures" items={procedures} />
        <EvidenceSection title="Equipment" items={equipment} />
        <EvidenceSection title="Specialties" items={specialties} />
      </div>

      <Card className="border-[#E7DED2] bg-white shadow-sm lg:sticky lg:top-24">
        <CardHeader>
          <CardTitle className="text-2xl text-[#0B2026]">Reviewer Panel</CardTitle>
          <CardDescription>Capture the final disposition and notes for this facility record.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {decisionError && (
            <div className="rounded-2xl border border-[#F4B4AE] bg-[#FFF4F2] px-4 py-3 text-sm text-[#9B2C2C]">
              {decisionError}
            </div>
          )}

          {decisionLoading && !decision ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-[#0B2026]">Status</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStatus(option.value)}
                      className={[
                        'rounded-2xl border px-4 py-3 text-sm font-medium transition-colors',
                        getStatusButtonClass(option.value, status),
                      ].join(' ')}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-[#E7DED2] bg-[#FAF8F4] px-4 py-3">
                <div>
                  <Label htmlFor="shortlisted" className="text-sm font-semibold text-[#0B2026]">
                    Shortlist this facility
                  </Label>
                  <p className="text-sm text-[#5D6B70]">
                    Keep high-value records visible for downstream enrichment.
                  </p>
                </div>
                <Switch
                  id="shortlisted"
                  checked={shortlisted}
                  onCheckedChange={setShortlisted}
                  className="data-[state=unchecked]:bg-[#B8A99A] data-[state=unchecked]:border-[#9C8C7E]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-notes" className="text-sm font-semibold text-[#0B2026]">
                  Reviewer notes
                </Label>
                <Textarea
                  id="review-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Add rationale, follow-up actions, or data quality observations."
                  className="min-h-32 border-[#D8CDC0] bg-white text-gray-900 placeholder:text-gray-400"
                />
              </div>

              <Button
                onClick={() => void saveDecision()}
                disabled={saving}
                className="w-full bg-[#FF3621] text-white hover:bg-[#E22C19]"
              >
                {saving ? 'Saving…' : 'Save Decision'}
              </Button>

              <div className="rounded-2xl border border-[#E7DED2] bg-[#FAF8F4] px-4 py-3 text-sm text-[#5D6B70]">
                <p>
                  <span className="font-semibold text-[#0B2026]">Reviewed by:</span>{' '}
                  {decision?.reviewed_by?.trim() ? decision.reviewed_by : 'Unassigned'}
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-[#0B2026]">Last updated:</span>{' '}
                  {decision?.updated_at ? formatTimestamp(decision.updated_at) : 'Not yet reviewed'}
                </p>
              </div>

              <Button asChild variant="outline" className="w-full border-[#D8CDC0] bg-white text-[#0B2026]">
                <Link to="/queue">Back to Queue</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

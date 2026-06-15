import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  useAnalyticsQuery,
} from '@databricks/appkit-ui/react';
import { MapPin } from 'lucide-react';

export type ReviewStatus = 'pending' | 'approved' | 'flagged' | 'rejected';

export interface Decision {
  unique_id: string;
  status: ReviewStatus;
  reviewer_notes: string;
  shortlisted: boolean;
  reviewed_by: string;
  updated_at: string;
}

const STATUS_FILTERS: Array<{ value: 'all' | ReviewStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'rejected', label: 'Rejected' },
];

function getSeverity(missingFieldCount: number | string): { label: string; className: string } {
  const n = Number(missingFieldCount);
  if (n >= 5) {
    return { label: 'High', className: 'border-[#F4B4AE] bg-[#FFF2F0] text-[#C53030]' };
  }

  if (n >= 3) {
    return { label: 'Medium', className: 'border-[#F2D39A] bg-[#FFF8EA] text-[#B7791F]' };
  }

  return { label: 'Clean', className: 'border-[#B8DEC7] bg-[#F4FBF6] text-[#2F855A]' };
}

function getStatusClassName(status: ReviewStatus): string {
  switch (status) {
    case 'approved':
      return 'border-[#B8DEC7] bg-[#F4FBF6] text-[#2F855A]';
    case 'flagged':
      return 'border-[#F2D39A] bg-[#FFF8EA] text-[#B7791F]';
    case 'rejected':
      return 'border-[#F4B4AE] bg-[#FFF2F0] text-[#C53030]';
    default:
      return 'border-[#D8CDC0] bg-[#F8F4EF] text-[#5D6B70]';
  }
}

function getMissingFieldTags(item: {
  missing_description: boolean;
  missing_doctors: boolean;
  missing_capacity: boolean;
  missing_year: boolean;
  missing_specialties: boolean;
}): string[] {
  const tags: string[] = [];

  if (item.missing_description) {
    tags.push('No Description');
  }
  if (item.missing_doctors) {
    tags.push('No Doctors');
  }
  if (item.missing_capacity) {
    tags.push('No Capacity');
  }
  if (item.missing_year) {
    tags.push('No Year');
  }
  if (item.missing_specialties) {
    tags.push('No Specialties');
  }

  return tags;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

export function ReviewQueuePage() {
  const emptyParams = useMemo(() => ({}), []);
  const { data: queueData, loading, error } = useAnalyticsQuery('review_queue', emptyParams);
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map());
  const [decisionsLoading, setDecisionsLoading] = useState(true);
  const [decisionsError, setDecisionsError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState('all-states');
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const abortController = new AbortController();

    async function loadDecisions() {
      setDecisionsLoading(true);
      setDecisionsError(null);

      try {
        const response = await fetch('/api/review/decisions', {
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to load review decisions (${response.status})`);
        }

        const payload = (await response.json()) as Decision[];
        setDecisions(new Map(payload.map((decision) => [decision.unique_id, decision])));
      } catch (errorValue) {
        if (abortController.signal.aborted) {
          return;
        }

        setDecisionsError(
          errorValue instanceof Error ? errorValue.message : 'Failed to load review decisions',
        );
      } finally {
        if (!abortController.signal.aborted) {
          setDecisionsLoading(false);
        }
      }
    }

    void loadDecisions();

    return () => abortController.abort();
  }, []);

  const availableStates = useMemo(() => {
    const values = new Set<string>();

    for (const item of queueData ?? []) {
      const s = String(item.state ?? '').trim();
      if (s) {
        values.add(s);
      }
    }

    return [...values].sort((left, right) => left.localeCompare(right));
  }, [queueData]);

  const filteredQueue = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return (queueData ?? []).filter((item) => {
      const reviewStatus = decisions.get(item.unique_id)?.status ?? 'pending';
      const matchesSearch =
        normalizedSearch.length === 0 ||
        String(item.name ?? '').toLowerCase().includes(normalizedSearch);
      const matchesState =
        stateFilter === 'all-states' || String(item.state ?? '') === stateFilter;
      const matchesStatus = statusFilter === 'all' || reviewStatus === statusFilter;

      return matchesSearch && matchesState && matchesStatus;
    });
  }, [decisions, queueData, searchTerm, stateFilter, statusFilter]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight text-[#0B2026]">Review Queue</h2>
          <p className="text-sm text-[#5D6B70] sm:text-base">
            100 highest-priority facilities queued for reviewer triage and decision capture.
          </p>
        </div>
        <div className="text-sm text-[#5D6B70]">
          {decisionsLoading ? 'Loading review decisions…' : `${filteredQueue.length} facilities in view`}
        </div>
      </section>

      <Card className="border-[#E7DED2] bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Filter queue</CardTitle>
          <CardDescription>Search by facility name, state, or review status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search facility name"
              className="border-[#D8CDC0] bg-white"
            />
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="border-[#D8CDC0] bg-white">
                <SelectValue placeholder="All states" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-states">All states</SelectItem>
                {availableStates.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => {
              const active = filter.value === statusFilter;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={[
                    'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'border-[#FF3621] bg-[#FF3621] text-white'
                      : 'border-[#D8CDC0] bg-[#F8F4EF] text-[#41545A] hover:border-[#FF3621] hover:text-[#FF3621]',
                  ].join(' ')}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-2xl border border-[#F4B4AE] bg-[#FFF4F2] px-4 py-3 text-sm text-[#9B2C2C]">
          Failed to load review queue: {error}
        </div>
      )}

      {!error && decisionsError && (
        <div className="rounded-2xl border border-[#F2D39A] bg-[#FFF8EA] px-4 py-3 text-sm text-[#8C5A13]">
          Review decisions could not be loaded. Queue items are shown with default pending status.
        </div>
      )}

      {loading && (
        <div className="grid gap-4">
          {Array.from({ length: 5 }, (_, index) => (
            <Card key={`queue-skeleton-${index}`} className="border-[#E7DED2] bg-white shadow-sm">
              <CardContent className="space-y-4 p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && filteredQueue.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[#D8CDC0] bg-white px-6 py-16 text-center shadow-sm">
          <h3 className="text-lg font-semibold text-[#0B2026]">No facilities match these filters</h3>
          <p className="mt-2 text-sm text-[#5D6B70]">
            Try a broader search term or switch back to all states and all statuses.
          </p>
        </div>
      )}

      {!loading && !error && filteredQueue.length > 0 && (
        <div className="grid gap-4">
          {filteredQueue.map((item) => {
            const severity = getSeverity(item.missing_field_count);
            const decision = decisions.get(item.unique_id);
            const reviewStatus = decision?.status ?? 'pending';
            const missingFieldTags = getMissingFieldTags(item);

            return (
              <Link
                key={item.unique_id}
                to={`/record/${encodeURIComponent(item.unique_id)}`}
                className="block"
              >
                <Card className="border-[#E7DED2] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#FF3621] hover:shadow-md">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-[#0B2026]">{String(item.name ?? '')}</h3>
                          <Badge className="border border-[#D8CDC0] bg-[#F8F4EF] text-[#41545A]">
                            {String(item.facility_type ?? '')}
                          </Badge>
                          {decision?.shortlisted && (
                            <Badge className="border border-[#FFD5CF] bg-[#FFF1EE] text-[#B42318]">
                              Shortlisted
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[#5D6B70]">
                          <MapPin className="h-4 w-4" />
                          <span>
                          {String(item.city ?? '')}, {String(item.state ?? '')}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Badge className={`border ${severity.className}`}>
                          {severity.label} · {item.missing_field_count} missing
                        </Badge>
                        <Badge className={`border ${getStatusClassName(reviewStatus)}`}>
                          {reviewStatus.charAt(0).toUpperCase() + reviewStatus.slice(1)}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {missingFieldTags.map((tag) => (
                        <Badge
                          key={`${item.unique_id}-${tag}`}
                          className="border border-[#D8CDC0] bg-[#F8F4EF] text-[#5D6B70]"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <p className="text-sm leading-6 text-[#5D6B70]">
                      {String(item.description_preview ?? '').trim()
                        ? truncate(item.description_preview, 180)
                        : 'No description preview available for this facility.'}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

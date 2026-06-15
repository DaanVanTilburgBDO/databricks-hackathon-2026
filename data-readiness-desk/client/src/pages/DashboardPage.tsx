import { useMemo } from 'react';
import { Link } from 'react-router';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useAnalyticsQuery,
} from '@databricks/appkit-ui/react';

function getCoverageBarColor(value: number | string): string {
  const n = Number(value);
  if (n < 50) {
    return 'bg-[#D0473B]';
  }

  if (n <= 80) {
    return 'bg-[#D9982A]';
  }

  return 'bg-[#2E8B57]';
}

function getPercentageTone(value: number | string): string {
  const n = Number(value);
  if (n < 50) {
    return 'text-[#D0473B]';
  }

  if (n <= 80) {
    return 'text-[#B7791F]';
  }

  return 'text-[#2F855A]';
}

function formatFieldName(fieldName: string): string {
  return fieldName
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPercentage(value: number | string): string {
  return `${Number(value).toFixed(1)}%`;
}

export function DashboardPage() {
  const emptyParams = useMemo(() => ({}), []);
  const { data: summaryData, loading: summaryLoading, error: summaryError } =
    useAnalyticsQuery('quality_summary', emptyParams);
  const {
    data: fieldCoverageData,
    loading: fieldCoverageLoading,
    error: fieldCoverageError,
  } = useAnalyticsQuery('field_completeness', emptyParams);
  const {
    data: stateDistributionData,
    loading: stateDistributionLoading,
    error: stateDistributionError,
  } = useAnalyticsQuery('state_distribution', emptyParams);

  const summary = summaryData?.[0];
  const sortedFieldCoverage = useMemo(
    () => [...(fieldCoverageData ?? [])].sort((left, right) => Number(left.pct_complete) - Number(right.pct_complete)),
    [fieldCoverageData],
  );

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-3xl border border-[#E7DED2] bg-white px-6 py-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <span className="inline-flex rounded-full bg-[#FFE5E0] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#B42318]">
            Track 4 · Data Quality
          </span>
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight text-[#0B2026]">
              Prioritize review work with a fast picture of dataset readiness.
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-[#41545A] sm:text-base">
              Audit field coverage, spot under-documented states, and route the riskiest
              healthcare facility records into reviewer workflows.
            </p>
          </div>
        </div>

        <Button asChild className="bg-[#FF3621] text-white hover:bg-[#E22C19]">
          <Link to="/queue">Open Review Queue →</Link>
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryLoading &&
          Array.from({ length: 4 }, (_, index) => (
            <Card key={`summary-skeleton-${index}`} className="border-[#E7DED2] bg-white shadow-sm">
              <CardHeader>
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}

        {!summaryLoading && summaryError && (
          <div className="md:col-span-2 xl:col-span-4 rounded-2xl border border-[#F4B4AE] bg-[#FFF4F2] px-4 py-3 text-sm text-[#9B2C2C]">
            Failed to load quality summary: {summaryError}
          </div>
        )}

        {!summaryLoading && !summaryError && !summary && (
          <div className="md:col-span-2 xl:col-span-4 rounded-2xl border border-dashed border-[#D8CDC0] bg-white px-4 py-10 text-center text-sm text-[#5D6B70]">
            No quality summary is available for this dataset.
          </div>
        )}

        {!summaryLoading && !summaryError && summary && (
          <>
            <Card className="border-[#E7DED2] bg-white shadow-sm">
              <CardHeader>
                <CardDescription>Total Facilities</CardDescription>
                <CardTitle className="text-4xl text-[#0B2026]">
                  {Number(summary.total_facilities).toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#5D6B70]">Records profiled across the healthcare facility dataset.</p>
              </CardContent>
            </Card>
            <Card className="border-[#F3C3BC] bg-[#FFF6F4] shadow-sm">
              <CardHeader>
                <CardDescription className="text-[#9B2C2C]">High Priority</CardDescription>
                <CardTitle className="text-4xl text-[#C53030]">
                  {Number(summary.high_priority).toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#8A3A32]">Records missing five or more key data fields.</p>
              </CardContent>
            </Card>
            <Card className="border-[#F0D6A8] bg-[#FFF9EE] shadow-sm">
              <CardHeader>
                <CardDescription className="text-[#9C5D0D]">Medium Priority</CardDescription>
                <CardTitle className="text-4xl text-[#B7791F]">
                  {Number(summary.medium_priority).toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#8B6A3A]">Records missing three to four fields that need review.</p>
              </CardContent>
            </Card>
            <Card className="border-[#B8DEC7] bg-[#F4FBF6] shadow-sm">
              <CardHeader>
                <CardDescription className="text-[#236A45]">Clean Records</CardDescription>
                <CardTitle className="text-4xl text-[#2F855A]">
                  {Number(summary.low_priority).toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#41795D]">Records with zero to two missing fields.</p>
              </CardContent>
            </Card>
          </>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-[#E7DED2] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-[#0B2026]">Field Coverage</CardTitle>
            <CardDescription>
              Worst-to-best completeness across the core fields used in review decisions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fieldCoverageLoading && (
              <div className="space-y-5">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={`field-skeleton-${index}`} className="space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            )}

            {!fieldCoverageLoading && fieldCoverageError && (
              <div className="rounded-2xl border border-[#F4B4AE] bg-[#FFF4F2] px-4 py-3 text-sm text-[#9B2C2C]">
                Failed to load field coverage: {fieldCoverageError}
              </div>
            )}

            {!fieldCoverageLoading && !fieldCoverageError && sortedFieldCoverage.length === 0 && (
              <p className="py-10 text-center text-sm text-[#5D6B70]">
                No field coverage metrics were returned.
              </p>
            )}

            {!fieldCoverageLoading && !fieldCoverageError && sortedFieldCoverage.length > 0 && (
              <div className="space-y-5">
                {sortedFieldCoverage.map((field) => (
                  <div key={field.field_name} className="space-y-2">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium text-[#0B2026]">
                        {formatFieldName(field.field_name)}
                      </span>
                      <span className={`font-semibold ${getPercentageTone(field.pct_complete)}`}>
                        {formatPercentage(field.pct_complete)}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#F2E9DF]">
                      <div
                        className={`h-full rounded-full ${getCoverageBarColor(field.pct_complete)}`}
                        style={{ width: `${Math.min(100, Math.max(0, Number(field.pct_complete)))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#E7DED2] bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-[#0B2026]">Coverage by State</CardTitle>
            <CardDescription>
              Compare record counts with description and capability coverage across regions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stateDistributionLoading && (
              <div className="space-y-3">
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton key={`state-skeleton-${index}`} className="h-10 w-full" />
                ))}
              </div>
            )}

            {!stateDistributionLoading && stateDistributionError && (
              <div className="rounded-2xl border border-[#F4B4AE] bg-[#FFF4F2] px-4 py-3 text-sm text-[#9B2C2C]">
                Failed to load state coverage: {stateDistributionError}
              </div>
            )}

            {!stateDistributionLoading && !stateDistributionError && !stateDistributionData?.length && (
              <p className="py-10 text-center text-sm text-[#5D6B70]">
                No state coverage metrics were returned.
              </p>
            )}

            {!stateDistributionLoading && !stateDistributionError && !!stateDistributionData?.length && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>State</TableHead>
                      <TableHead className="text-right">Facilities</TableHead>
                      <TableHead className="text-right">Description %</TableHead>
                      <TableHead className="text-right">Capability %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stateDistributionData.map((row) => (
                      <TableRow key={row.state}>
                        <TableCell className="font-medium text-[#0B2026]">{row.state}</TableCell>
                        <TableCell className="text-right text-[#41545A]">
                          {Number(row.facility_count).toLocaleString()}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${getPercentageTone(row.desc_pct)}`}>
                          {formatPercentage(row.desc_pct)}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${getPercentageTone(row.capability_pct)}`}>
                          {formatPercentage(row.capability_pct)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

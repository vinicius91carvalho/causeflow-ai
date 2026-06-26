/**
 * Loading skeleton for the integrations grid.
 * Shows 6 placeholder cards while data is fetching.
 */

const SKELETON_IDS = [
  'skeleton-slack',
  'skeleton-pagerduty',
  'skeleton-datadog',
  'skeleton-github',
  'skeleton-jira',
  'skeleton-cloudwatch',
];

export function IntegrationsSkeleton() {
  return (
    <section
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading integrations"
    >
      {SKELETON_IDS.map((id) => (
        <div
          key={id}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 animate-pulse"
        >
          {/* Icon + name skeleton */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-24 rounded bg-muted" />
              <div className="h-2.5 w-16 rounded bg-muted" />
            </div>
          </div>
          {/* Description skeleton */}
          <div className="space-y-1.5 flex-1">
            <div className="h-2.5 w-full rounded bg-muted" />
            <div className="h-2.5 w-4/5 rounded bg-muted" />
          </div>
          {/* Button skeleton */}
          <div className="h-8 w-full rounded-md bg-muted" />
        </div>
      ))}
    </section>
  );
}

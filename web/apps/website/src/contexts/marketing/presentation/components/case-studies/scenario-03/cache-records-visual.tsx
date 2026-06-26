/**
 * CacheRecordsVisual — stylized DynamoDB cache-row grid.
 *
 * Represents ~80 cache rows, every one with revalidatedAt: 1 (never revalidated).
 * Rendered as a compact pill grid with a critical-finding callout.
 *
 * The "1" epoch timestamp is the DynamoDB sentinel indicating
 * the cache was set at deploy time and never warmed since.
 */

export interface CacheRecordsVisualLabels {
  title: string;
  pathLabel: string;
  revalidatedAtLabel: string;
  findingLabel: string;
  findingDescription: string;
  rowCount: string;
}

interface CacheRecordsVisualProps {
  labels: CacheRecordsVisualLabels;
}

// Generate 80 representative path slugs (mix of en/pt-br variants).
const PATHS = Array.from({ length: 80 }, (_, i) => {
  const locales = ['', '/pt-br'];
  const locale = locales[i % 2];
  return `${locale}/get-started?v=${String(i + 1).padStart(3, '0')}`;
});

export function CacheRecordsVisual({ labels }: CacheRecordsVisualProps) {
  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h4 className="font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {labels.title}
        </h4>
        <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-red-600">
          {labels.rowCount}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-border pb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span>{labels.pathLabel}</span>
        <span>{labels.revalidatedAtLabel}</span>
      </div>

      {/* Scrollable pill grid — max-height to keep section compact */}
      <section
        className="max-h-[280px] overflow-y-auto rounded-lg border border-border bg-muted/20"
        aria-label={labels.title}
      >
        <div className="divide-y divide-border/60">
          {PATHS.map((path) => (
            <div key={path} className="grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-1.5">
              <span className="truncate font-mono text-[11.5px] text-foreground/70">{path}</span>
              {/* revalidatedAt: 1 — sentinel for "never warmed" */}
              <span className="inline-flex items-center rounded bg-red-500/10 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-red-600">
                1
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Critical finding callout */}
      <div className="flex gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="8.5" />
          <path strokeLinecap="round" d="M10 6v4.5M10 13.5v.5" />
        </svg>
        <div>
          <p className="font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-red-600">
            {labels.findingLabel}
          </p>
          <p className="mt-1 text-[13px] leading-[1.55] text-muted-foreground">
            {labels.findingDescription}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * BeforeAfterArch — two mini architecture diagrams side by side.
 *
 * Before: SSR only — fetch on every request, CMS is single point of failure.
 * After:  ISR with revalidate: 300 + try/catch fallback.
 *
 * Before uses muted/subdued colors. After uses accent (green) colors.
 * Stacks vertically on mobile, side by side at sm+.
 */

export interface BeforeAfterArchLabels {
  beforeLabel: string;
  afterLabel: string;
  beforeSubtitle: string;
  afterSubtitle: string;
  ssrLabel: string;
  isrLabel: string;
  cmsLabel: string;
  lambdaLabel: string;
  cacheLabel: string;
  fallbackLabel: string;
  /** Small annotation above the before-arrow (default: "no cache"). */
  noCacheAnnotation: string;
  /** Annotation under the CMS node on the BEFORE diagram. */
  singlePointOfFailure: string;
  /** Small sublabel under ISR cache node (default: "revalidate: 300"). */
  revalidateAnnotation: string;
}

interface BeforeAfterArchProps {
  labels: BeforeAfterArchLabels;
}

export function BeforeAfterArch({ labels }: BeforeAfterArchProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
      {/* ── BEFORE ── */}
      <div className="rounded-2xl border border-border bg-muted/30 p-5">
        <div className="mb-4 space-y-0.5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {labels.beforeLabel}
          </p>
          <p className="text-[13px] text-muted-foreground">{labels.beforeSubtitle}</p>
        </div>

        {/* Before SVG: SSR → CMS (direct, no cache) */}
        <svg
          viewBox="0 0 280 140"
          fill="none"
          className="w-full opacity-70"
          role="img"
          aria-label={labels.beforeLabel}
        >
          {/* Lambda node */}
          <rect
            x="20"
            y="50"
            width="100"
            height="40"
            rx="8"
            fill="hsl(var(--muted))"
            stroke="hsl(var(--border))"
            strokeWidth="1.5"
          />
          <text
            x="70"
            y="68"
            textAnchor="middle"
            fontSize="11"
            fontWeight="500"
            fill="hsl(var(--foreground))"
          >
            {labels.lambdaLabel}
          </text>
          <text x="70" y="82" textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">
            {labels.ssrLabel}
          </text>

          {/* Arrow → CMS (direct, no cache) */}
          <line
            x1="120"
            y1="70"
            x2="170"
            y2="70"
            stroke="hsl(var(--destructive))"
            strokeWidth="1.5"
          />
          <polygon points="170,65 180,70 170,75" fill="hsl(var(--destructive))" />

          {/* "no cache" label */}
          <text x="150" y="62" textAnchor="middle" fontSize="8" fill="hsl(var(--muted-foreground))">
            {labels.noCacheAnnotation}
          </text>

          {/* CMS node — muted red */}
          <rect
            x="180"
            y="50"
            width="80"
            height="40"
            rx="8"
            fill="hsl(var(--destructive) / 0.08)"
            stroke="hsl(var(--destructive) / 0.5)"
            strokeWidth="1.5"
          />
          <text
            x="220"
            y="68"
            textAnchor="middle"
            fontSize="11"
            fontWeight="500"
            fill="hsl(var(--destructive) / 0.8)"
          >
            {labels.cmsLabel}
          </text>
          <text
            x="220"
            y="82"
            textAnchor="middle"
            fontSize="9"
            fill="hsl(var(--destructive) / 0.6)"
          >
            503
          </text>

          {/* Single point of failure annotation */}
          <text x="220" y="116" textAnchor="middle" fontSize="9" fill="hsl(var(--destructive))">
            {labels.singlePointOfFailure}
          </text>
          <line
            x1="220"
            y1="90"
            x2="220"
            y2="106"
            stroke="hsl(var(--destructive) / 0.5)"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        </svg>
      </div>

      {/* ── AFTER ── */}
      <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-5">
        <div className="mb-4 space-y-0.5">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-green-600">
            {labels.afterLabel}
          </p>
          <p className="text-[13px] text-muted-foreground">{labels.afterSubtitle}</p>
        </div>

        {/* After SVG: ISR + cache + fallback */}
        <svg
          viewBox="0 0 280 140"
          fill="none"
          className="w-full"
          role="img"
          aria-label={labels.afterLabel}
        >
          {/* Lambda node */}
          <rect
            x="10"
            y="50"
            width="90"
            height="40"
            rx="8"
            fill="hsl(var(--muted))"
            stroke="hsl(var(--border))"
            strokeWidth="1.5"
          />
          <text
            x="55"
            y="68"
            textAnchor="middle"
            fontSize="11"
            fontWeight="500"
            fill="hsl(var(--foreground))"
          >
            {labels.lambdaLabel}
          </text>
          <text x="55" y="82" textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">
            {labels.isrLabel}
          </text>

          {/* Arrow → ISR cache (green) */}
          <line x1="100" y1="70" x2="135" y2="70" stroke="hsl(142 71% 45%)" strokeWidth="1.5" />
          <polygon points="135,65 145,70 135,75" fill="hsl(142 71% 45%)" />

          {/* ISR Cache node */}
          <rect
            x="145"
            y="50"
            width="70"
            height="40"
            rx="8"
            fill="hsl(var(--muted))"
            stroke="hsl(142 71% 45%)"
            strokeWidth="1.5"
          />
          <text
            x="180"
            y="68"
            textAnchor="middle"
            fontSize="11"
            fontWeight="500"
            fill="hsl(142 71% 38%)"
          >
            {labels.cacheLabel}
          </text>
          <text x="180" y="82" textAnchor="middle" fontSize="8" fill="hsl(var(--muted-foreground))">
            {labels.revalidateAnnotation}
          </text>

          {/* Arrow → CMS (dashed — optional) */}
          <line
            x1="215"
            y1="70"
            x2="248"
            y2="70"
            stroke="hsl(var(--border))"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
          <polygon points="248,65 258,70 248,75" fill="hsl(var(--border))" />

          {/* CMS node — muted, non-critical */}
          <rect
            x="258"
            y="55"
            width="16"
            height="30"
            rx="4"
            fill="hsl(var(--muted))"
            stroke="hsl(var(--border))"
            strokeWidth="1"
          />

          {/* Fallback arc */}
          <path
            d="M 180 90 Q 100 130 55 90"
            stroke="hsl(142 71% 45%)"
            strokeWidth="1.5"
            strokeDasharray="3 2"
            fill="none"
          />
          <text
            x="118"
            y="130"
            textAnchor="middle"
            fontSize="9"
            fill="hsl(142 71% 38%)"
            fontWeight="500"
          >
            {labels.fallbackLabel}
          </text>
        </svg>
      </div>
    </div>
  );
}

/**
 * CascadeArchitectureDiagram — full-width inline SVG.
 *
 * Flow: Visitors → CloudFront → Next.js Lambda → CMS
 * The CMS node pulses red to indicate the incident hot path.
 * Arrow from Lambda to CMS is highlighted; no cache box exists.
 *
 * Mobile-first: nodes stack vertically under 640px (flex-col),
 * arrange horizontally at sm+.
 *
 * prefers-reduced-motion: disables the CMS pulse animation.
 */

export interface CascadeArchitectureDiagramLabels {
  visitors: string;
  cdn: string;
  lambda: string;
  cms: string;
  hotPath: string;
  incidentNote: string;
  /** Sublabel under visitors node (e.g. "Users"). */
  visitorsSub: string;
  /** Sublabel under CDN node (e.g. "CloudFront"). */
  cdnSub: string;
  /** Sublabel under Lambda node (e.g. "SSR Lambda"). */
  lambdaSub: string;
  /** Sublabel under CMS node (e.g. "503 Service Unavailable"). */
  cmsSub: string;
  /** Small annotation above the Lambda→CMS arrow (e.g. "no cache"). */
  noCacheAnnotation: string;
}

interface CascadeArchitectureDiagramProps {
  labels: CascadeArchitectureDiagramLabels;
}

export function CascadeArchitectureDiagram({ labels }: CascadeArchitectureDiagramProps) {
  return (
    <div className="w-full overflow-x-auto">
      {/* Mobile layout: vertical stack */}
      <div className="flex flex-col items-center gap-3 sm:hidden">
        <MobileNode label={labels.visitors} variant="default" />
        <VerticalArrow />
        <MobileNode label={labels.cdn} variant="default" />
        <VerticalArrow />
        <MobileNode label={labels.lambda} variant="default" />
        <VerticalArrow incident />
        <MobileNode label={labels.cms} variant="error" />
        <p className="mt-2 text-center font-mono text-[11px] text-red-500">{labels.incidentNote}</p>
      </div>

      {/* Desktop layout: horizontal SVG */}
      <div className="hidden sm:block">
        <svg
          viewBox="0 0 820 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
          aria-label={labels.hotPath}
          role="img"
        >
          {/* Definitions: pulse animation + reduced-motion override */}
          <defs>
            <style>{`
              @keyframes cms-pulse {
                0%, 100% { opacity: 1; }
                50%       { opacity: 0.45; }
              }
              .cms-pulse { animation: cms-pulse 1.6s ease-in-out infinite; }
              @media (prefers-reduced-motion: reduce) {
                .cms-pulse { animation: none; }
              }
            `}</style>
          </defs>

          {/* ── Node: Visitors ── */}
          <rect
            x="20"
            y="70"
            width="140"
            height="60"
            rx="12"
            className="fill-muted stroke-border"
            strokeWidth="1.5"
          />
          <text
            x="90"
            y="96"
            textAnchor="middle"
            className="fill-foreground font-sans text-[13px] font-medium"
            fontSize="13"
            fontWeight="500"
            fill="hsl(var(--foreground))"
          >
            {labels.visitors}
          </text>
          <text
            x="90"
            y="114"
            textAnchor="middle"
            fontSize="11"
            fill="hsl(var(--muted-foreground))"
          >
            {labels.visitorsSub}
          </text>

          {/* Arrow: Visitors → CloudFront */}
          <line
            x1="160"
            y1="100"
            x2="220"
            y2="100"
            stroke="hsl(var(--border))"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <polygon points="220,95 230,100 220,105" fill="hsl(var(--border))" />

          {/* ── Node: CloudFront CDN ── */}
          <rect
            x="230"
            y="70"
            width="140"
            height="60"
            rx="12"
            className="fill-muted stroke-border"
            strokeWidth="1.5"
          />
          <text
            x="300"
            y="96"
            textAnchor="middle"
            fontSize="13"
            fontWeight="500"
            fill="hsl(var(--foreground))"
          >
            {labels.cdn}
          </text>
          <text
            x="300"
            y="114"
            textAnchor="middle"
            fontSize="11"
            fill="hsl(var(--muted-foreground))"
          >
            {labels.cdnSub}
          </text>

          {/* Arrow: CloudFront → Lambda */}
          <line
            x1="370"
            y1="100"
            x2="430"
            y2="100"
            stroke="hsl(var(--border))"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <polygon points="430,95 440,100 430,105" fill="hsl(var(--border))" />

          {/* ── Node: Next.js Lambda ── */}
          <rect
            x="440"
            y="70"
            width="140"
            height="60"
            rx="12"
            className="fill-muted stroke-border"
            strokeWidth="1.5"
          />
          <text
            x="510"
            y="96"
            textAnchor="middle"
            fontSize="13"
            fontWeight="500"
            fill="hsl(var(--foreground))"
          >
            {labels.lambda}
          </text>
          <text
            x="510"
            y="114"
            textAnchor="middle"
            fontSize="11"
            fill="hsl(var(--muted-foreground))"
          >
            {labels.lambdaSub}
          </text>

          {/* Arrow: Lambda → CMS (hot path — red) */}
          <line
            x1="580"
            y1="100"
            x2="640"
            y2="100"
            stroke="hsl(var(--destructive))"
            strokeWidth="2"
          />
          <polygon points="640,95 650,100 640,105" fill="hsl(var(--destructive))" />

          {/* Hot path label */}
          <text
            x="615"
            y="90"
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="hsl(var(--destructive))"
          >
            {labels.hotPath}
          </text>

          {/* ── Node: CMS (incident) — pulsing red ── */}
          <g className="cms-pulse">
            <rect
              x="650"
              y="62"
              width="150"
              height="76"
              rx="12"
              fill="hsl(var(--destructive) / 0.08)"
              stroke="hsl(var(--destructive))"
              strokeWidth="2"
            />
            {/* Error glow */}
            <rect
              x="650"
              y="62"
              width="150"
              height="76"
              rx="12"
              fill="none"
              stroke="hsl(var(--destructive) / 0.25)"
              strokeWidth="8"
            />
          </g>
          <text
            x="725"
            y="96"
            textAnchor="middle"
            fontSize="13"
            fontWeight="600"
            fill="hsl(var(--destructive))"
          >
            {labels.cms}
          </text>
          <text
            x="725"
            y="114"
            textAnchor="middle"
            fontSize="11"
            fill="hsl(var(--destructive) / 0.8)"
          >
            {labels.cmsSub}
          </text>

          {/* Incident note below CMS */}
          <text x="725" y="160" textAnchor="middle" fontSize="10" fill="hsl(var(--destructive))">
            {labels.incidentNote}
          </text>

          {/* No-cache annotation above Lambda→CMS arrow */}
          <text x="615" y="78" textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))">
            {labels.noCacheAnnotation}
          </text>
        </svg>
      </div>
    </div>
  );
}

/* ── Mobile helpers ── */

type NodeVariant = 'default' | 'error';

function MobileNode({ label, variant }: { label: string; variant: NodeVariant }) {
  const base =
    'flex h-12 w-48 items-center justify-center rounded-xl border text-[13px] font-medium';
  const styles: Record<NodeVariant, string> = {
    default: `${base} border-border bg-muted text-foreground`,
    error: `${base} border-red-500 bg-red-500/10 text-red-600`,
  };
  return <div className={styles[variant]}>{label}</div>;
}

function VerticalArrow({ incident = false }: { incident?: boolean }) {
  const color = incident ? 'text-red-500' : 'text-muted-foreground';
  return (
    <svg
      viewBox="0 0 24 32"
      className={`h-8 w-6 ${color}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <line x1="12" y1="0" x2="12" y2="24" />
      <polyline points="6,18 12,26 18,18" />
    </svg>
  );
}

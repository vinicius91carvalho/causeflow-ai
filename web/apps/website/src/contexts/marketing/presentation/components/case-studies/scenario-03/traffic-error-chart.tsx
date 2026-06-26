/**
 * TrafficErrorChart — synchronized dual-line SVG chart.
 *
 * Green line = request volume (rising spike).
 * Red line   = 5xx error count (rises with traffic).
 *
 * Both lines use SVG <path> with polyline data representing
 * the LinkedIn spike window: quiet → spike → errors cascade → recovery.
 *
 * prefers-reduced-motion: disables line-draw animation (stroke-dashoffset).
 * Mobile-first: viewBox + w-full keeps chart readable at any width.
 */

export interface TrafficErrorChartLabels {
  title: string;
  requestsLabel: string;
  errorsLabel: string;
  timeLabel: string;
  linkedInSpike: string;
  recoveryLabel: string;
}

interface TrafficErrorChartProps {
  labels: TrafficErrorChartLabels;
}

// Chart data points — (x, y) normalized to viewBox 0-700, 0-180.
// x = time axis (0..700), y = value axis (0=top, 180=bottom).
const REQUESTS_POINTS =
  '0,160 80,155 160,140 220,80 280,50 340,40 400,55 460,90 520,120 600,140 700,148';
const ERRORS_POINTS =
  '0,175 80,174 160,172 220,155 280,100 340,85 400,95 460,155 520,168 600,172 700,174';

export function TrafficErrorChart({ labels }: TrafficErrorChartProps) {
  return (
    <div className="w-full space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[12px] font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-6 rounded-full"
            style={{ background: 'hsl(142 71% 45%)' }}
            aria-hidden="true"
          />
          {labels.requestsLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-6 rounded-full"
            style={{ background: 'hsl(0 84% 60%)' }}
            aria-hidden="true"
          />
          {labels.errorsLabel}
        </span>
      </div>

      {/* Chart */}
      <div className="relative w-full overflow-hidden rounded-xl border border-border bg-muted/30">
        <svg
          viewBox="0 0 700 200"
          preserveAspectRatio="xMidYMid meet"
          className="w-full"
          role="img"
          aria-label={labels.title}
        >
          <defs>
            {/* Line-draw animation for requests */}
            <style>{`
              .chart-line-requests {
                stroke-dasharray: 1200;
                stroke-dashoffset: 1200;
                animation: draw-line 1.8s ease-out 0.2s forwards;
              }
              .chart-line-errors {
                stroke-dasharray: 1200;
                stroke-dashoffset: 1200;
                animation: draw-line 1.8s ease-out 0.5s forwards;
              }
              @keyframes draw-line {
                to { stroke-dashoffset: 0; }
              }
              @media (prefers-reduced-motion: reduce) {
                .chart-line-requests,
                .chart-line-errors {
                  animation: none;
                  stroke-dashoffset: 0;
                }
              }
            `}</style>

            {/* Grid line pattern */}
            <pattern id="grid" width="70" height="45" patternUnits="userSpaceOnUse">
              <path
                d="M 70 0 L 0 0 0 45"
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth="0.4"
              />
            </pattern>
          </defs>

          {/* Grid background */}
          <rect width="700" height="200" fill="url(#grid)" />

          {/* LinkedIn spike annotation */}
          <line
            x1="280"
            y1="0"
            x2="280"
            y2="200"
            stroke="hsl(var(--accent) / 0.4)"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
          <text x="286" y="16" fontSize="9" fill="hsl(var(--accent))" fontWeight="600">
            {labels.linkedInSpike}
          </text>

          {/* Recovery annotation */}
          <line
            x1="460"
            y1="0"
            x2="460"
            y2="200"
            stroke="hsl(var(--muted-foreground) / 0.4)"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
          <text x="466" y="16" fontSize="9" fill="hsl(var(--muted-foreground))">
            {labels.recoveryLabel}
          </text>

          {/* Request volume line (green) */}
          <polyline
            className="chart-line-requests"
            points={REQUESTS_POINTS}
            fill="none"
            stroke="hsl(142 71% 45%)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Error count line (red) */}
          <polyline
            className="chart-line-errors"
            points={ERRORS_POINTS}
            fill="none"
            stroke="hsl(0 84% 60%)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Axis label */}
          <text x="4" y="196" fontSize="9" fill="hsl(var(--muted-foreground))">
            {labels.timeLabel}
          </text>
        </svg>
      </div>
    </div>
  );
}

/**
 * ColdStartMathSvg — inline SVG showing 3 concurrent Lambda lanes
 * each colliding with a vertical 5000 ms "wall".
 *
 * All numeric labels come from props (initDurationMs, fetchDurationMs,
 * totalBudgetMs) — no hardcoded values in JSX so PT-BR can reuse.
 *
 * The SVG has role="img" + aria-label for screen readers.
 */

export interface ColdStartMathSvgProps {
  initDurationMs: number;
  fetchDurationMs: number;
  totalBudgetMs: number;
  laneCount: number;
  caption: string;
  wallLabel: string;
}

export function ColdStartMathSvg({
  initDurationMs,
  fetchDurationMs,
  totalBudgetMs,
  laneCount,
  caption,
  wallLabel,
}: ColdStartMathSvgProps) {
  // SVG coordinate system: 0–800 wide, lanes stacked vertically
  const svgWidth = 800;
  const laneHeight = 36;
  const laneGap = 14;
  const topPad = 32;
  const bottomPad = 28;
  const leftPad = 16;
  const rightPad = 40;
  const usableWidth = svgWidth - leftPad - rightPad;

  const totalDisplayMs = initDurationMs + fetchDurationMs + 500; // slight overflow shown
  const msToX = (ms: number) => leftPad + (ms / totalDisplayMs) * usableWidth;

  const wallX = msToX(totalBudgetMs);
  const initEndX = msToX(initDurationMs);
  const totalEndX = msToX(initDurationMs + fetchDurationMs);

  const svgHeight = topPad + laneCount * (laneHeight + laneGap) - laneGap + bottomPad;

  const lanes = Array.from({ length: laneCount }, (_, i) => {
    const y = topPad + i * (laneHeight + laneGap);
    return { y, index: i };
  });

  return (
    <div className="w-full space-y-3">
      <svg
        role="img"
        aria-label={`Diagram showing ${laneCount} concurrent Lambda invocations each consuming ${initDurationMs} ms cold start plus ${fetchDurationMs} ms fetch, exceeding the ${totalBudgetMs} ms budget wall`}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full"
        style={{ maxHeight: 220 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* X-axis time markers */}
        {[0, initDurationMs, totalBudgetMs, initDurationMs + fetchDurationMs].map((ms) => (
          <g key={ms}>
            <line
              x1={msToX(ms)}
              y1={topPad - 8}
              x2={msToX(ms)}
              y2={svgHeight - bottomPad + 4}
              stroke="hsl(var(--border))"
              strokeWidth="1"
              strokeDasharray={ms === totalBudgetMs ? '0' : '4 3'}
            />
            <text
              x={msToX(ms)}
              y={topPad - 12}
              textAnchor="middle"
              fontSize="10"
              fill="hsl(var(--muted-foreground))"
              fontFamily="monospace"
            >
              {ms} ms
            </text>
          </g>
        ))}

        {/* Budget wall — solid red vertical line */}
        <line
          x1={wallX}
          y1={topPad - 4}
          x2={wallX}
          y2={svgHeight - bottomPad + 4}
          stroke="hsl(var(--destructive, 0 84% 60%))"
          strokeWidth="2"
        />
        <text
          x={wallX + 4}
          y={topPad - 12}
          fontSize="10"
          fill="hsl(var(--destructive, 0 84% 60%))"
          fontFamily="monospace"
          fontWeight="600"
        >
          {wallLabel}
        </text>

        {/* Lane bars */}
        {lanes.map(({ y, index }) => (
          <g key={index}>
            {/* Cold start segment — muted gray */}
            <rect
              x={leftPad}
              y={y}
              width={initEndX - leftPad}
              height={laneHeight}
              rx="4"
              fill="hsl(var(--muted))"
            />
            <text
              x={leftPad + (initEndX - leftPad) / 2}
              y={y + laneHeight / 2 + 4}
              textAnchor="middle"
              fontSize="10"
              fill="hsl(var(--muted-foreground))"
              fontFamily="monospace"
            >
              INIT {initDurationMs} ms
            </text>

            {/* Fetch segment — amber, runs past the wall */}
            <rect
              x={initEndX}
              y={y}
              width={totalEndX - initEndX}
              height={laneHeight}
              rx="4"
              fill="hsl(38 92% 50% / 0.25)"
            />

            {/* Overflow past wall — red tint */}
            <rect
              x={wallX}
              y={y}
              width={Math.max(0, totalEndX - wallX)}
              height={laneHeight}
              rx="0"
              fill="hsl(0 84% 60% / 0.20)"
            />

            {/* Timeout X marker */}
            <text
              x={totalEndX + 6}
              y={y + laneHeight / 2 + 4}
              fontSize="12"
              fill="hsl(0 84% 60%)"
              fontFamily="monospace"
              fontWeight="700"
            >
              ✕
            </text>

            {/* Lane label */}
            <text
              x={leftPad - 4}
              y={y + laneHeight / 2 + 4}
              textAnchor="end"
              fontSize="10"
              fill="hsl(var(--muted-foreground))"
              fontFamily="monospace"
            >
              #{index + 1}
            </text>
          </g>
        ))}
      </svg>

      {/* Caption — receives full arithmetic string from i18n */}
      <p className="font-mono text-[11.5px] leading-[1.6] text-muted-foreground">{caption}</p>
    </div>
  );
}

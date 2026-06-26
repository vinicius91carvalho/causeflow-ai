/**
 * TwoBugsDiagram — Scenario 01 (Stale Pricing)
 *
 * Inline SVG data-flow diagram: CMS → Webhook → Seeder → DynamoDB → Subscriber → Next.js
 * Two red X glyphs mark failure points:
 *   X1 — between Seeder and DynamoDB  (missing tag map: "pricing-page" → "/pricing")
 *   X2 — between DynamoDB and Subscriber (TypeError on missing NewImage for DELETE events)
 *
 * Hover/tap on each X reveals a tooltip with the failing code snippet.
 * prefers-reduced-motion: pulse animations are disabled.
 * Mobile: diagram flows as a narrower centered block; nodes stack naturally via SVG viewBox.
 */

export function TwoBugsDiagram() {
  return (
    <div className="w-full overflow-x-auto">
      {/* Outer wrapper — group enables Tailwind group-hover on child tooltips */}
      <div className="relative mx-auto w-full max-w-[820px]">
        <svg
          viewBox="0 0 820 220"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Data-flow diagram showing two failure points in the CMS revalidation pipeline"
          role="img"
          className="w-full"
        >
          {/* ── Connector lines ─────────────────────────────────────────────── */}
          {/* CMS → Webhook */}
          <line
            x1="108"
            y1="110"
            x2="178"
            y2="110"
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="1.5"
          />
          {/* Webhook → Seeder */}
          <line
            x1="248"
            y1="110"
            x2="318"
            y2="110"
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="1.5"
          />
          {/* Seeder → [X1] → DynamoDB */}
          <line
            x1="388"
            y1="110"
            x2="428"
            y2="110"
            stroke="hsl(var(--destructive, 0 84% 60%) / 0.4)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <line
            x1="462"
            y1="110"
            x2="498"
            y2="110"
            stroke="hsl(var(--destructive, 0 84% 60%) / 0.4)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          {/* DynamoDB → [X2] → Subscriber */}
          <line
            x1="568"
            y1="110"
            x2="608"
            y2="110"
            stroke="hsl(var(--destructive, 0 84% 60%) / 0.4)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <line
            x1="642"
            y1="110"
            x2="678"
            y2="110"
            stroke="hsl(var(--destructive, 0 84% 60%) / 0.4)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          {/* Subscriber → Next.js */}
          <line
            x1="748"
            y1="110"
            x2="790"
            y2="110"
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />

          {/* ── Nodes ───────────────────────────────────────────────────────── */}

          {/* CMS */}
          <NodeBox x={18} y={85} width={90} height={50} label="CMS" sublabel="Contentful" />

          {/* Webhook */}
          <NodeBox x={178} y={85} width={70} height={50} label="Webhook" sublabel="HTTP POST" />

          {/* Seeder Lambda */}
          <NodeBox x={318} y={85} width={70} height={50} label="Seeder" sublabel="Lambda" />

          {/* DynamoDB */}
          <NodeBox x={498} y={85} width={70} height={50} label="DynamoDB" sublabel="Table" />

          {/* Subscriber Lambda */}
          <NodeBox x={678} y={85} width={70} height={50} label="Subscriber" sublabel="Lambda" />

          {/* Next.js — faded out (never reached) */}
          <g opacity="0.35">
            <rect
              x={790}
              y={85}
              width={22}
              height={50}
              rx="8"
              fill="currentColor"
              fillOpacity="0.06"
              stroke="currentColor"
              strokeOpacity="0.2"
              strokeWidth="1"
            />
            <text
              x={801}
              y={113}
              textAnchor="middle"
              fontSize="7"
              fill="currentColor"
              fillOpacity="0.7"
              fontFamily="monospace"
            >
              Next
            </text>
            <text
              x={801}
              y={123}
              textAnchor="middle"
              fontSize="6"
              fill="currentColor"
              fillOpacity="0.45"
              fontFamily="monospace"
            >
              .js
            </text>
          </g>

          {/* ── Bug X1 — missing tag map ─────────────────────────────────────── */}
          <BugMarker
            x={445}
            y={110}
            tooltipX={370}
            tooltipY={138}
            tooltipWidth={210}
            tooltipLines={[
              'Bug 1: Missing tag mapping',
              '"pricing-page" → no paths registered',
              'Seeder skips — pathCount: 0',
            ]}
          />

          {/* ── Bug X2 — TypeError on missing NewImage ───────────────────────── */}
          <BugMarker
            x={625}
            y={110}
            tooltipX={530}
            tooltipY={138}
            tooltipWidth={230}
            tooltipLines={[
              'Bug 2: TypeError at handler:23',
              'record.dynamodb.NewImage undefined',
              'on DELETE events → retries: 3 → stuck',
            ]}
          />

          {/* ── Legend ──────────────────────────────────────────────────────── */}
          <g transform="translate(18, 168)">
            <line
              x1="0"
              y1="6"
              x2="18"
              y2="6"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="1.5"
            />
            <text
              x="22"
              y="9"
              fontSize="9"
              fill="currentColor"
              fillOpacity="0.5"
              fontFamily="monospace"
            >
              working path
            </text>
            <line
              x1="110"
              y1="6"
              x2="128"
              y2="6"
              stroke="hsl(var(--destructive, 0 84% 60%) / 0.5)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <text
              x="132"
              y="9"
              fontSize="9"
              fill="currentColor"
              fillOpacity="0.5"
              fontFamily="monospace"
            >
              blocked path
            </text>
            <circle
              cx="238"
              cy="6"
              r="5"
              fill="hsl(var(--destructive, 0 84% 60%) / 0.15)"
              stroke="hsl(var(--destructive, 0 84% 60%))"
              strokeWidth="1.2"
            />
            <text
              x="246"
              y="3"
              fontSize="8"
              fontWeight="bold"
              className="fill-red-500"
              fontFamily="monospace"
            >
              ✕
            </text>
            <text
              x="256"
              y="9"
              fontSize="9"
              fill="currentColor"
              fillOpacity="0.5"
              fontFamily="monospace"
            >
              failure point (hover for details)
            </text>
          </g>
        </svg>

        {/* pulse ring — disabled when prefers-reduced-motion: reduce */}
        <style>{`
          @media (prefers-reduced-motion: no-preference) {
            .bug-pulse {
              animation: bug-pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }
          }
          @keyframes bug-pulse-ring {
            0%, 100% { opacity: 0.7; r: 8; }
            50% { opacity: 0.3; r: 11; }
          }
        `}</style>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function NodeBox({
  x,
  y,
  width,
  height,
  label,
  sublabel,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  sublabel: string;
}) {
  const cx = x + width / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="8"
        fill="currentColor"
        fillOpacity="0.05"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="1"
      />
      <text
        x={cx}
        y={y + height / 2 - 4}
        textAnchor="middle"
        fontSize="9"
        fontWeight="600"
        fill="currentColor"
        fillOpacity="0.85"
        fontFamily="monospace"
      >
        {label}
      </text>
      <text
        x={cx}
        y={y + height / 2 + 8}
        textAnchor="middle"
        fontSize="7.5"
        fill="currentColor"
        fillOpacity="0.45"
        fontFamily="monospace"
      >
        {sublabel}
      </text>
    </g>
  );
}

function BugMarker({
  x,
  y,
  tooltipX,
  tooltipY,
  tooltipWidth,
  tooltipLines,
}: {
  x: number;
  y: number;
  tooltipX: number;
  tooltipY: number;
  tooltipWidth: number;
  tooltipLines: string[];
}) {
  const tooltipHeight = tooltipLines.length * 13 + 10;
  return (
    <g className="group" style={{ cursor: 'pointer' }}>
      {/* Outer pulse ring — red-500 accent per design token spec */}
      <circle
        cx={x}
        cy={y}
        r="10"
        className="fill-red-500/10 stroke-red-500/35 bug-pulse"
        strokeWidth="1"
      />
      {/* Inner fill */}
      <circle cx={x} cy={y} r="7" className="fill-red-500/20 stroke-red-500" strokeWidth="1.4" />
      {/* X glyph — text-red-600 per design token spec */}
      <line
        x1={x - 3}
        y1={y - 3}
        x2={x + 3}
        y2={y + 3}
        className="stroke-red-600"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1={x + 3}
        y1={y - 3}
        x2={x - 3}
        y2={y + 3}
        className="stroke-red-600"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Tooltip — visible on hover/focus (CSS group-hover via SVG foreignObject fallback) */}
      <g className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100">
        <rect
          x={tooltipX}
          y={tooltipY}
          width={tooltipWidth}
          height={tooltipHeight}
          rx="6"
          fill="hsl(var(--card))"
          stroke="hsl(var(--destructive, 0 84% 60%) / 0.4)"
          strokeWidth="1"
        />
        {tooltipLines.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static tooltip lines
          <text
            key={i}
            x={tooltipX + 10}
            y={tooltipY + 14 + i * 13}
            fontSize="8.5"
            fill="hsl(var(--foreground) / 0.85)"
            fontFamily="monospace"
          >
            {line}
          </text>
        ))}
      </g>
    </g>
  );
}

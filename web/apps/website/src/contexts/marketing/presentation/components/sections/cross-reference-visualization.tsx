'use client';

import { cn } from '@causeflow/ui/lib';
import { useAnimateOnScroll } from '@causeflow/ui/themes';
import { useEffect, useState } from 'react';
import {
  TOOLS as ALL_TOOLS,
  BRAIN_SVG_ACCENT_PATHS,
  BRAIN_SVG_HIGHLIGHT_CIRCLES,
  BRAIN_SVG_MAIN_PATH,
  BRAIN_SVG_PURPLE_PATH,
} from '@/contexts/marketing/domain/constants';

interface CrossReferenceVisualizationProps {
  rootCauseLabel: string;
  confidenceLabel: string;
  fixDescription: string;
  fixButtonLabel: string;
  processingLabel: string;
  className?: string;
}

const TOOLS = ALL_TOOLS.slice(0, 6);

export function CrossReferenceVisualization({
  rootCauseLabel,
  confidenceLabel,
  fixDescription,
  fixButtonLabel,
  className,
}: CrossReferenceVisualizationProps) {
  const { ref, isVisible } = useAnimateOnScroll<HTMLDivElement>();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 400),
      setTimeout(() => setPhase(3), 1300),
      setTimeout(() => setPhase(4), 3800),
      setTimeout(() => setPhase(5), 5100),
    ];

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [isVisible]);

  const radius = 120;
  const cx = 160;
  const cy = 160;

  return (
    <div
      ref={ref}
      className={cn(
        'relative flex flex-col items-center gap-4 overflow-hidden rounded-xl border border-slate-700 bg-slate-900/50 p-6',
        className,
      )}
    >
      <svg
        viewBox="0 0 320 320"
        className="h-full max-h-[280px] w-full max-w-[280px]"
        aria-hidden="true"
      >
        {/* Connection lines from tools to center */}
        {TOOLS.map((tool, i) => {
          const angle = (i * 2 * Math.PI) / TOOLS.length - Math.PI / 2;
          const tx = cx + radius * Math.cos(angle);
          const ty = cy + radius * Math.sin(angle);

          return (
            <line
              key={`line-${tool.name}`}
              x1={tx}
              y1={ty}
              x2={cx}
              y2={cy}
              stroke="hsl(var(--accent) / 0.4)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              className={cn(
                'transition-opacity duration-700',
                phase >= 2 ? 'opacity-100' : 'opacity-0',
              )}
              style={{
                transitionDelay: `${i * 100}ms`,
              }}
            />
          );
        })}

        {/* Data flow particles — stop before card appears */}
        {phase >= 3 &&
          phase < 4 &&
          TOOLS.map((tool, i) => {
            const angle = (i * 2 * Math.PI) / TOOLS.length - Math.PI / 2;
            const tx = cx + radius * Math.cos(angle);
            const ty = cy + radius * Math.sin(angle);
            return (
              <circle key={`particle-${tool.name}`} r="3" fill={tool.color} opacity="0.7">
                <animateMotion
                  dur={`${1.2 + i * 0.2}s`}
                  repeatCount="indefinite"
                  path={`M${tx},${ty} L${cx},${cy}`}
                />
              </circle>
            );
          })}

        {/* Tool nodes — float on <g> so text moves with circle */}
        {TOOLS.map((tool, i) => {
          const angle = (i * 2 * Math.PI) / TOOLS.length - Math.PI / 2;
          const tx = cx + radius * Math.cos(angle);
          const ty = cy + radius * Math.sin(angle);

          return (
            <g
              key={tool.name}
              className={cn(
                'transition-opacity duration-500',
                phase >= 1 ? 'opacity-100' : 'opacity-0',
                phase >= 5 && 'animate-float',
              )}
              style={{
                transitionDelay: `${i * 80}ms`,
                animationDelay: phase >= 5 ? `${i * 500}ms` : undefined,
              }}
            >
              <circle
                cx={tx}
                cy={ty}
                r="28"
                fill="hsl(220, 20%, 12%)"
                stroke={tool.color}
                strokeWidth="1.5"
              />
              <text
                x={tx}
                y={ty}
                textAnchor="middle"
                dominantBaseline="central"
                fill="hsl(0, 0%, 80%)"
                fontSize="9"
                fontWeight="500"
              >
                {tool.name}
              </text>
            </g>
          );
        })}

        {/* Center brain node — translate wrapper so scale animates from center */}
        <g transform={`translate(${cx}, ${cy})`}>
          <g
            className={cn(
              'transition-transform duration-700',
              phase >= 3 && phase < 5 && 'animate-center-receive',
              phase >= 5 && 'scale-125',
            )}
          >
            {/* Pulse ring (continuous after phase 5) */}
            {phase >= 5 && (
              <circle
                cx={0}
                cy={0}
                r="38"
                fill="none"
                stroke="hsl(var(--accent) / 0.3)"
                strokeWidth="2"
                className="animate-pulse-ring"
              />
            )}
            {/* Scanning ring — rotating dashed border (phases 3-4) */}
            {phase >= 3 && phase < 5 && (
              <circle
                cx={0}
                cy={0}
                r="38"
                fill="none"
                stroke="hsl(var(--accent) / 0.3)"
                strokeWidth="1.5"
                strokeDasharray="8 4"
                className="animate-glow-pulse"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 0 0"
                  to="360 0 0"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
            <circle
              cx={0}
              cy={0}
              r="38"
              fill="hsl(var(--accent) / 0.1)"
              stroke="hsl(var(--accent))"
              strokeWidth="2"
              className={cn('transition-all duration-500', phase >= 3 && 'animate-glow-pulse')}
            />
            {/* Brain icon — favicon SVG scaled to fit (smaller than circle) */}
            <g transform="scale(0.10) translate(-256, -256)" fillRule="evenodd" clipRule="evenodd">
              <path fill="hsl(var(--accent))" d={BRAIN_SVG_MAIN_PATH} />
              {BRAIN_SVG_HIGHLIGHT_CIRCLES.map((c) => (
                <circle key={`${c.cx}-${c.cy}`} cx={c.cx} cy={c.cy} r={c.r} fill="#8b5cf6" />
              ))}
              {BRAIN_SVG_ACCENT_PATHS.map((d) => (
                <path key={d.slice(2, 20)} fill="hsl(var(--accent))" d={d} />
              ))}
              <path fill="#8b5cf6" d={BRAIN_SVG_PURPLE_PATH} />
            </g>
          </g>
        </g>
      </svg>

      {/* Result card wrapper with transition */}
      <div
        className={cn(
          'relative w-full max-w-xs transition-all duration-700',
          phase >= 4 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        )}
      >
        {/* Circulating border light */}
        {phase >= 4 && (
          <div
            className="pointer-events-none absolute -inset-[1px] z-0 overflow-hidden rounded-lg"
            aria-hidden="true"
          >
            <div
              className="absolute inset-[-50%] animate-spin"
              style={{
                background:
                  'conic-gradient(from 0deg, transparent 0%, transparent 60%, hsl(var(--accent) / 0.6) 75%, hsl(var(--accent)) 80%, hsl(var(--accent) / 0.6) 85%, transparent 100%)',
                animationDuration: '3s',
              }}
            />
            {/* Inner mask — cuts out center so only border edge is visible */}
            <div className="absolute inset-[1.5px] rounded-[7px] bg-slate-800/80" />
          </div>
        )}
        {/* Card content */}
        <div className="relative z-10 w-full rounded-lg bg-slate-800/80 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20">
              <svg
                aria-hidden="true"
                className="h-3 w-3 text-success"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-white">{rootCauseLabel}</span>
            <span className="ml-auto rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
              {confidenceLabel}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{fixDescription}</p>
          {/* Fix PR button */}
          <button
            type="button"
            className={cn(
              'mt-3 w-full rounded-md bg-accent/20 px-3 py-1.5 text-xs font-medium text-accent transition-all duration-500',
              phase >= 5 ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
            )}
            tabIndex={-1}
          >
            <span
              className={cn(
                phase >= 5 &&
                  'animate-shimmer bg-gradient-to-r from-accent via-accent/70 to-accent bg-clip-text',
              )}
            >
              {fixButtonLabel}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

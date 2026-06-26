'use client';

import { cn } from '@causeflow/ui/lib';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BRAIN_SVG_ACCENT_PATHS,
  BRAIN_SVG_HIGHLIGHT_CIRCLES,
  BRAIN_SVG_MAIN_PATH,
  BRAIN_SVG_PURPLE_PATH,
  TOOLS,
} from '@/contexts/marketing/domain/constants';

interface InvestigationDashboardPreviewProps {
  rootCauseLabel?: string;
  confidenceLabel?: string;
  fixDescription?: string;
  fixButtonLabel?: string;
  processingLabel?: string;
  className?: string;
}

const CX = 180;
const CY = 170;
const RADIUS = 130;
const REPULSE_RADIUS = 100;
const REPULSE_STRENGTH = 20;

function getBasePosition(index: number) {
  const angle = (index * 2 * Math.PI) / TOOLS.length - Math.PI / 2;
  return {
    x: CX + RADIUS * Math.cos(angle),
    y: CY + RADIUS * Math.sin(angle),
  };
}

/** Animated investigation visualization for the hero section with mouse-interactive nodes. */
export function InvestigationDashboardPreview({
  rootCauseLabel = 'Root Cause Identified',
  confidenceLabel = '97% confidence',
  fixDescription = 'Memory leak in connection pool — auto-scaling triggered at 3:42 AM caused PostgreSQL max_connections overflow.',
  fixButtonLabel = 'Open Fix PR \u2192',
  className,
}: InvestigationDashboardPreviewProps) {
  const [phase, setPhase] = useState(0);
  const [activeToolIndex, setActiveToolIndex] = useState(-1);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [isInView, setIsInView] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number>(0);

  // Start the phase sequence only when the section enters the viewport,
  // otherwise users who scroll past quickly see a completed animation.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setPhase(5);
      setIsInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsInView(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!isInView) return;
    setPhase(0);
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 4800),
      setTimeout(() => setPhase(5), 6100),
    ];
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [isInView]);

  // Tool scanning animation in phase 3
  useEffect(() => {
    if (phase < 3 || phase >= 4) {
      setActiveToolIndex(-1);
      return;
    }
    let idx = 0;
    const interval = setInterval(() => {
      setActiveToolIndex(idx % TOOLS.length);
      idx++;
      if (idx >= TOOLS.length * 2) clearInterval(interval);
    }, 120);
    return () => clearInterval(interval);
  }, [phase]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Convert mouse screen coords to SVG viewBox coords (RAF-throttled)
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (rafRef.current) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    rafRef.current = requestAnimationFrame(() => {
      const svg = svgRef.current;
      if (!svg) {
        rafRef.current = 0;
        return;
      }
      const rect = svg.getBoundingClientRect();
      const scaleX = 360 / rect.width;
      const scaleY = 340 / rect.height;
      setMouse({
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      });
      rafRef.current = 0;
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    setMouse(null);
  }, []);

  // Compute repulsed position with smooth cosine falloff
  function getNodePosition(index: number) {
    const base = getBasePosition(index);
    if (!mouse) return base;

    const dx = base.x - mouse.x;
    const dy = base.y - mouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > REPULSE_RADIUS || dist < 1) return base;

    // Cosine easing: smooth at both edges (zero derivative at boundary)
    const t = dist / REPULSE_RADIUS;
    const force = REPULSE_STRENGTH * (0.5 + 0.5 * Math.cos(t * Math.PI));

    return {
      x: base.x + (dx / dist) * force,
      y: base.y + (dy / dist) * force,
    };
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        // Transparent root so the parent section's background shows through
        // cleanly. The SVG animation + result card below provide all the
        // surfaces the user needs; a frosted bg-card/60 just muddies the scene.
        'relative flex flex-col items-center gap-3 overflow-hidden p-4',
        className,
      )}
    >
      {/* Ambient glow */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0 transition-opacity duration-1000',
          phase >= 3 ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden="true"
      >
        <div className="absolute top-1/2 left-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/8 blur-[60px]" />
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 360 340"
        className="relative h-full max-h-[300px] w-full max-w-[320px]"
        aria-hidden="true"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Connection lines */}
        {TOOLS.map((tool, i) => {
          const pos = getNodePosition(i);
          return (
            <line
              key={`line-${tool.name}`}
              x1={pos.x}
              y1={pos.y}
              x2={CX}
              y2={CY}
              stroke={activeToolIndex === i ? tool.color : 'hsl(var(--accent) / 0.45)'}
              strokeWidth={activeToolIndex === i ? '2' : '1'}
              strokeDasharray="4 3"
              className={cn(
                'transition-opacity duration-500',
                phase >= 2 ? 'opacity-100' : 'opacity-0',
              )}
              style={{ transitionDelay: `${i * 60}ms` }}
            />
          );
        })}

        {/* Data flow particles — stop before card appears */}
        {phase >= 3 &&
          phase < 4 &&
          TOOLS.map((tool, i) => {
            const base = getBasePosition(i);
            return (
              <circle key={`particle-${tool.name}`} r="3" fill={tool.color} opacity="0.8">
                <animateMotion
                  dur={`${1.2 + i * 0.15}s`}
                  repeatCount="indefinite"
                  path={`M${base.x},${base.y} L${CX},${CY}`}
                />
              </circle>
            );
          })}

        {/* Tool nodes — float and text on <g> so everything moves together */}
        {TOOLS.map((tool, i) => {
          const pos = getNodePosition(i);
          const isActive = activeToolIndex === i;

          return (
            <g
              key={tool.name}
              className={cn(
                phase >= 1 ? 'opacity-100' : 'opacity-0',
                phase >= 5 && !mouse && 'animate-float',
              )}
              style={{
                transition: 'opacity 0.4s ease',
                transitionDelay: phase < 2 ? `${i * 60}ms` : '0ms',
                animationDelay: phase >= 5 && !mouse ? `${i * 400}ms` : undefined,
                willChange: 'transform',
              }}
            >
              {/* Active glow ring */}
              {isActive && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="30"
                  fill="none"
                  stroke={tool.color}
                  strokeWidth="1.5"
                  opacity="0.4"
                  className="animate-pulse-ring"
                />
              )}
              <circle
                cx={pos.x}
                cy={pos.y}
                r="26"
                fill="hsl(var(--card))"
                stroke={tool.color}
                strokeWidth={isActive ? '2' : '1.5'}
                opacity={isActive ? '1' : '0.8'}
              />
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={isActive ? tool.color : 'hsl(var(--muted-foreground))'}
                fontSize="8"
                fontWeight={isActive ? '700' : '500'}
              >
                {tool.name}
              </text>
            </g>
          );
        })}

        {/* Center brain node — translate wrapper so scale animates from center */}
        <g transform={`translate(${CX}, ${CY})`}>
          <g
            className={cn(
              'transition-transform duration-700',
              phase >= 3 && phase < 5 && 'animate-center-receive',
              phase >= 5 && 'scale-125',
            )}
          >
            {/* Outer pulse ring */}
            {phase >= 5 && (
              <circle
                cx={0}
                cy={0}
                r="40"
                fill="none"
                stroke="hsl(var(--accent) / 0.2)"
                strokeWidth="2"
                className="animate-pulse-ring"
              />
            )}
            {/* Scanning ring */}
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
            {/* Main circle */}
            <circle
              cx={0}
              cy={0}
              r="36"
              fill="hsl(var(--accent) / 0.08)"
              stroke="hsl(var(--accent))"
              strokeWidth="2"
              className={cn('transition-all duration-500', phase >= 3 && 'animate-glow-pulse')}
            />
            {/* Brain icon — favicon SVG scaled to fit (smaller than circle) */}
            <g transform="scale(0.105) translate(-256, -256)" fillRule="evenodd" clipRule="evenodd">
              <path fill="hsl(var(--accent))" d={BRAIN_SVG_MAIN_PATH} />
              {BRAIN_SVG_HIGHLIGHT_CIRCLES.map((c) => (
                <circle
                  key={`${c.cx}-${c.cy}`}
                  cx={c.cx}
                  cy={c.cy}
                  r={c.r}
                  fill="hsl(var(--chart-4))"
                />
              ))}
              {BRAIN_SVG_ACCENT_PATHS.map((d) => (
                <path key={d.slice(2, 20)} fill="hsl(var(--accent))" d={d} />
              ))}
              <path fill="hsl(var(--chart-4))" d={BRAIN_SVG_PURPLE_PATH} />
            </g>
          </g>
        </g>
      </svg>

      {/* Result card */}
      <div
        className={cn(
          'relative w-full max-w-sm transition-all duration-700',
          phase >= 4 ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
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
            <div className="absolute inset-[1.5px] rounded-[7px] bg-card/90" />
          </div>
        )}
        {/* Card content */}
        <div className="relative z-10 w-full rounded-lg bg-card/90 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/20">
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
            <span className="ml-auto shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
              {confidenceLabel}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{fixDescription}</p>
          <button
            type="button"
            className={cn(
              'mt-3 w-full rounded-md bg-accent/20 px-3 py-1.5 text-xs font-semibold text-accent transition-all duration-500',
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

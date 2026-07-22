import Image from 'next/image';
import { publicAsset } from '@/lib/public-asset';

/**
 * HowWorksSection — "Conecta. Investiga. Explica." 3-column strip.
 *
 * Visuals:
 *   01 Conectar   — horizontal integration stack: 5 brand tiles → CauseFlow core
 *   02 Investigar — parallel agent tracks: 4 concurrent agents with progress bars
 *   03 Explicar   — rootcause mini terminal + confidence row (taller)
 */

interface HowWorksSectionProps {
  eyebrow: string;
  headline: { s1: string; s2: string; s3: string };
  lead: string;
  steps: Array<{
    num: string;
    numLabel: string;
    title: string;
    description: string;
  }>;
  confidenceLabel: string;
}

export function HowWorksSection({
  eyebrow,
  headline,
  lead,
  steps,
  confidenceLabel,
}: HowWorksSectionProps) {
  return (
    <section id="product" className="bg-background px-4 py-[110px] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        {/* Section header */}
        <div className="mx-auto mb-14 max-w-[640px] text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.15em] text-accent">
            {eyebrow}
          </p>
          <h2
            className="mt-4 text-balance font-display font-normal tracking-[-0.03em] text-foreground"
            style={{ fontSize: 'clamp(2rem, 3vw + 0.8rem, 3.2rem)', lineHeight: 1.02 }}
          >
            <span>{headline.s1}</span>{' '}
            <em className="not-italic font-medium text-accent">{headline.s2}</em>{' '}
            <span>{headline.s3}</span>
          </h2>
          <p className="mt-4 text-pretty text-[17px] leading-[1.55] text-foreground/70">{lead}</p>
        </div>

        {/* Steps — 3 separate cards, white bg */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.num}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-[30px] py-9 shadow-[0_1px_2px_hsl(var(--foreground)/0.04)]"
            >
              <span className="font-mono text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {step.num} / <span className="text-accent">{step.numLabel}</span>
              </span>
              <h3 className="text-[18px] font-bold leading-[1.25] tracking-[-0.01em] text-foreground">
                {step.title}
              </h3>
              <p className="text-[14px] leading-[1.55] text-muted-foreground">{step.description}</p>

              {/* Step-specific visual */}
              <div className="mt-auto flex h-[180px] items-stretch overflow-hidden rounded-[10px] border border-border bg-muted/40">
                {i === 0 && <ConnectStackVisual />}
                {i === 1 && <ParallelAgentsVisual />}
                {i === 2 && <RootCauseVisual confidenceLabel={confidenceLabel} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Card 01 — integration stack converging on CauseFlow core ──────────────
// Left column: grid of 6 integration tiles. Right column: CauseFlow core with
// inward-pointing arrows. Communicates "plug many tools into one brain".
function ConnectStackVisual() {
  const tiles = [
    { id: 'sentry', src: publicAsset('/icons/integrations/sentry.svg'), label: 'Sentry' },
    { id: 'datadog', src: publicAsset('/icons/integrations/datadog.svg'), label: 'Datadog' },
    { id: 'grafana', src: publicAsset('/icons/integrations/grafana.svg'), label: 'Grafana' },
    { id: 'github', src: publicAsset('/icons/integrations/github.svg'), label: 'GitHub' },
    { id: 'slack', src: publicAsset('/icons/integrations/slack.svg'), label: 'Slack' },
    { id: 'pagerduty', src: publicAsset('/icons/integrations/pagerduty.svg'), label: 'PagerDuty' },
  ] as const;
  return (
    <div className="relative grid h-full w-full grid-cols-[1fr_auto] items-center gap-4 px-4 py-4">
      {/* 3x2 grid of integration tiles — icons only for a cleaner look */}
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <span
            key={t.id}
            aria-hidden="true"
            className="flex h-10 items-center justify-center rounded-md border border-border bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.06)]"
          >
            <Image
              src={t.src}
              alt=""
              aria-hidden="true"
              width={18}
              height={18}
              className="h-[18px] w-[18px]"
            />
          </span>
        ))}
      </div>
      {/* Flow arrows + CF core */}
      <div className="flex items-center gap-1.5">
        <svg aria-hidden="true" viewBox="0 0 28 64" className="h-14 w-6 text-accent" fill="none">
          {[16, 32, 48].map((y) => (
            <g key={y}>
              <line
                x1="2"
                y1={y}
                x2="22"
                y2={y}
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <path
                d={`M22 ${y} l-4 -3 M22 ${y} l-4 3`}
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </g>
          ))}
        </svg>
        <div
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-border bg-card shadow-[0_0_0_4px_hsl(var(--accent)/0.12)]"
        >
          <Image
            src="/favicon.svg"
            alt=""
            aria-hidden="true"
            width={28}
            height={28}
            className="h-7 w-7"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Card 02 — parallel agents with concurrent progress bars ───────────────
// Four horizontal tracks, each with an agent name + progress bar filled to a
// different percentage — communicates "working in parallel" clearly.
function ParallelAgentsVisual() {
  const agents = [
    { id: 'logs', label: 'LOGS', pct: 100, done: true },
    { id: 'metrics', label: 'METRICS', pct: 100, done: true },
    { id: 'code', label: 'CODE', pct: 72, done: false },
    { id: 'db', label: 'DB', pct: 55, done: false },
  ] as const;
  return (
    <div className="flex h-full w-full flex-col justify-center gap-2 px-4 py-4">
      {agents.map((a) => (
        <div key={a.id} className="flex items-center gap-2">
          <span className="w-16 shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-foreground/70">
            {a.label}
          </span>
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
            <span
              aria-hidden="true"
              className={`absolute inset-y-0 left-0 rounded-full ${a.done ? 'bg-[hsl(160_62%_38%)]' : 'bg-accent'}`}
              style={{ width: `${a.pct}%` }}
            />
          </div>
          <span
            className={`w-10 shrink-0 text-right font-mono text-[9.5px] font-semibold ${a.done ? 'text-[hsl(160_62%_38%)]' : 'text-accent'}`}
          >
            {a.done ? '✓' : `${a.pct}%`}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Card 03 — root-cause mini terminal (taller) ───────────────────────────
function RootCauseVisual({ confidenceLabel }: { confidenceLabel: string }) {
  return (
    <div className="h-full w-full px-3 py-3">
      <div className="flex h-full flex-col rounded-[9px] border border-border bg-card px-3 py-2.5 font-mono text-[11.5px] leading-[1.75] text-foreground/75">
        <div>
          <span className="font-semibold text-accent">root_cause:</span>
        </div>
        <div className="pl-3 text-foreground">cache_cdn_stale</div>
        <div className="mt-1">
          <span className="font-semibold text-accent">evidence:</span>
        </div>
        <div className="pl-3">
          <span className="font-bold text-[hsl(0_72%_48%)]">−</span> webhook 403
        </div>
        <div className="pl-3">
          <span className="font-bold text-[hsl(160_62%_38%)]">+</span> manual purge
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-1.5 text-[10px]">
          <span className="uppercase tracking-[0.08em] text-muted-foreground/80">
            {confidenceLabel}
          </span>
          <span className="font-bold text-accent">94%</span>
        </div>
      </div>
    </div>
  );
}

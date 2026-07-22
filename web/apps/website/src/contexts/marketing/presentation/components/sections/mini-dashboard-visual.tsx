'use client';

/**
 * MiniDashboardVisual — Hero right-side product mockup.
 *
 * Pixel-faithful port of the template `.hero-visual` + `.browser-frame` + `.dash`
 * layout.
 *
 * Typography (per template):
 *   - Sidebar labels (WORKSPACE): mono 10px / 700 uppercase / 0.12em tracking
 *   - Sidebar items: 13px / 500, 14px icons, count pill teal
 *   - Dashboard h3: Plus Jakarta Sans 15px / 700 / -0.01em
 *   - Subline: mono 12.5px, muted
 *   - Agent pill: 22x22 icon box, name mono 9.5px/600, status mono 9px
 *   - Evidence aside title: mono 10.5px / 700 uppercase / 0.1em
 *   - Evidence card label: mono 10px / 700 uppercase / 0.08em
 *   - Evidence card value: 13px / 700 / -0.01em
 *   - Evidence card sub: 11.5px / 1.4 line-height / soft ink
 *   - Feed: JetBrains Mono 12px / 1.8 line-height
 */

import Image from 'next/image';

interface MiniDashboardVisualProps {
  labels: {
    workspace: string;
    nav1: string;
    nav2: string;
    nav3: string;
    nav4: string;
    nav5: string;
    nav6: string;
    investigating: string;
    dashTitle: string;
    dashSubline: string;
    feedL1: string;
    feedL2: string;
    feedL3: string;
    feedL4: string;
    feedL5: string;
    feedL6: string;
    evidencesLabel: string;
    rootCause: string;
    rcVal: string;
    rcSub: string;
    confidence: string;
    evidence: string;
    proposed: string;
    proposedDesc: string;
    approve: string;
    details: string;
    float1: string;
    float2: string;
  };
}

export function MiniDashboardVisual({ labels }: MiniDashboardVisualProps) {
  return (
    <div className="relative mx-auto w-full max-w-[1080px]">
      {/* Float card — top right (~3 min / CAUSA RAIZ) */}
      <div className="absolute -top-5 right-6 z-10 flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-[0_20px_40px_-20px_hsl(var(--foreground)/0.2)]">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <div>
          <div className="text-[13px] font-bold leading-none text-foreground">~3 min</div>
          <div className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {labels.float1}
          </div>
        </div>
      </div>

      {/* Float card — bottom left (94% / EVIDÊNCIAS VALIDADAS) */}
      <div className="absolute -bottom-5 left-6 z-10 flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-[0_20px_40px_-20px_hsl(var(--foreground)/0.2)]">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(160_62%_92%)] text-[hsl(160_62%_38%)]">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <div>
          <div className="text-[13px] font-bold leading-none text-foreground">
            94%{' '}
            <span className="ml-0.5 font-mono text-[10.5px] font-medium text-muted-foreground">
              confidence
            </span>
          </div>
          <div className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {labels.float2}
          </div>
        </div>
      </div>

      {/* Browser frame */}
      <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_30px_60px_-30px_hsl(var(--foreground)/0.25),0_60px_120px_-60px_hsl(var(--accent)/0.15)]">
        {/* Browser chrome */}
        <div className="flex items-center gap-2.5 border-b border-border bg-muted/40 px-3.5 py-3">
          <div className="flex gap-1.5">
            <span className="h-[11px] w-[11px] rounded-full bg-border" />
            <span className="h-[11px] w-[11px] rounded-full bg-border" />
            <span className="h-[11px] w-[11px] rounded-full bg-border" />
          </div>
          <div className="mx-auto flex max-w-[360px] items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-[11.5px] text-muted-foreground">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="h-2.5 w-2.5 shrink-0 text-[hsl(160_62%_38%)]"
            >
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            </svg>
            localhost:3001/investigations/inv-2847
          </div>
        </div>

        {/* Dashboard grid: sidebar 220 / main 1fr / aside 320 */}
        <div className="grid min-h-[520px] font-[family-name:var(--font-jakarta)] lg:grid-cols-[220px_1fr_320px]">
          {/* ─── Sidebar ──────────────────────────── */}
          <aside className="hidden flex-col gap-0.5 border-r border-border bg-muted/30 p-4 text-[13px] md:flex">
            <div className="mb-1.5 px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {labels.workspace}
            </div>
            <SideItem icon={<BoltIcon />} label={labels.nav1} count={12} active />
            <SideItem icon={<ChartIcon />} label={labels.nav2} />
            <SideItem icon={<CogIcon />} label={labels.nav3} />
            <SideItem icon={<GridIcon />} label={labels.nav4} />
            <SideItem icon={<SliderIcon />} label={labels.nav5} />
            <SideItem icon={<MemoryIcon />} label={labels.nav6} />
          </aside>

          {/* ─── Main pane ────────────────────────── */}
          <div className="flex min-w-0 flex-col overflow-hidden bg-card px-5 py-[18px]">
            {/* Header row */}
            <div className="mb-1 flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] text-accent">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                </span>
                {labels.investigating}
              </span>
              <h3 className="ml-1 truncate text-[15px] font-bold tracking-[-0.01em] text-foreground">
                {labels.dashTitle}
              </h3>
              <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                02:47
                <br />
                ago
              </span>
            </div>
            <div className="mb-4 font-mono text-[12.5px] text-muted-foreground">
              {labels.dashSubline}
            </div>

            {/* Agent row — 4 pills on mobile, 6 on sm+ (colored to match feed-line tags) */}
            <div className="mb-[18px] grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              <AgentPillV label="LOGS" time="1.2s" color="accent" icon={<LogsIcon />} />
              <AgentPillV label="METRICS" time="0.9s" color="indigo" icon={<MetricsIcon />} />
              <AgentPillV label="CODE" time="2.4s" color="orange" icon={<CodeIcon />} />
              <AgentPillV label="DB" time="1.8s" color="violet" icon={<DbIcon />} />
              <AgentPillV
                label="INFRA"
                time="idle"
                color="muted"
                icon={<InfraIcon />}
                className="hidden sm:flex"
              />
              <AgentPillV
                label="DOCS"
                time="idle"
                color="muted"
                icon={<DocsIcon />}
                className="hidden sm:flex"
              />
            </div>

            {/* Feed — 4 lines on mobile, 6 on sm+ */}
            <div className="relative flex-1 overflow-hidden border-t border-border pt-3.5 font-mono text-[12px] leading-[1.8] text-foreground/70">
              <FeedLine time="00:02" tag="logs" color="accent" text={labels.feedL1} />
              <FeedLine time="00:04" tag="db" color="violet" text={labels.feedL2} />
              <div className="hidden sm:block">
                <FeedLine time="00:11" tag="code" color="orange" text={labels.feedL3} />
              </div>
              <div className="hidden sm:block">
                <FeedLine time="00:18" tag="metrics" color="indigo" text={labels.feedL4} />
              </div>
              <FeedLine time="00:32" tag="logs" color="accent" text={labels.feedL5} />
              <FeedLine time="02:47" tag="causa raiz" color="success" text={labels.feedL6} bold />
              {/* Fade out */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent"
              />
            </div>
          </div>

          {/* ─── Aside (evidence) ─────────────────── */}
          <aside className="hidden flex-col gap-3.5 border-t border-l border-border bg-muted/30 p-[18px] lg:flex">
            <div className="font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {labels.evidencesLabel}
            </div>

            {/* Root-cause evidence card (accent) */}
            <div className="rounded-[9px] border border-accent/30 bg-accent/10 px-3 py-2.5">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {labels.rootCause}
              </div>
              <div className="mt-1 text-[13px] font-bold tracking-[-0.01em] text-accent">
                {labels.rcVal}
              </div>
              <div className="mt-1 text-[11.5px] leading-[1.4] text-foreground/70">
                {labels.rcSub}
              </div>
              <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-foreground/10">
                <div className="h-full w-[94%] rounded-full bg-accent" />
              </div>
              <div className="mt-1.5 font-mono text-[10.5px] text-muted-foreground">
                94% <span className="text-muted-foreground/70">{labels.confidence}</span>
              </div>
            </div>

            {/* Evidence list card */}
            <div className="rounded-[9px] border border-border bg-card px-3 py-2.5">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {labels.evidence}
              </div>
              <div className="mt-2 font-mono text-[11.5px] leading-[1.55] text-foreground/70">
                <div>→ cms-webhook-worker: 5 × 403</div>
                <div>→ cdn /pricing age: 893s</div>
                <div>→ catalog.updated_at Δ 12min</div>
                <div>→ cache_purge log: empty</div>
              </div>
            </div>

            {/* Proposed-fix card (orange) */}
            <div className="rounded-[9px] border border-[hsl(23_90%_52%)]/25 bg-[hsl(23_90%_52%)]/5 px-3 py-2.5">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[hsl(23_90%_40%)]">
                {labels.proposed}
              </div>
              <div className="mt-1 text-[11.5px] leading-[1.5] text-foreground/80">
                {labels.proposedDesc}
              </div>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  className="rounded-md bg-accent px-2.5 py-1 font-mono text-[10px] font-bold text-accent-foreground"
                >
                  {labels.approve}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-border bg-card px-2.5 py-1 font-mono text-[10px] font-bold text-foreground"
                >
                  {labels.details}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SideItem({
  icon,
  label,
  count,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-[7px] px-2.5 py-[7px] text-[13px] ${
        active
          ? 'bg-foreground/[0.06] font-semibold text-foreground'
          : 'font-medium text-foreground/75'
      }`}
    >
      <span className="h-3.5 w-3.5 shrink-0 text-foreground/70">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="shrink-0 rounded-full bg-accent/15 px-[7px] py-[1px] font-mono text-[10.5px] font-semibold text-accent">
          {count}
        </span>
      )}
    </div>
  );
}

type AgentColor = 'accent' | 'violet' | 'orange' | 'indigo' | 'success' | 'muted';

const COLOR_RING: Record<AgentColor, string> = {
  accent: 'border-accent/50 bg-accent/5',
  violet: 'border-[hsl(var(--violet))]/50 bg-[hsl(var(--violet))]/5',
  orange: 'border-[hsl(23_90%_52%)]/50 bg-[hsl(23_90%_52%)]/5',
  indigo: 'border-primary/40 bg-primary/5',
  success: 'border-[hsl(160_62%_38%)]/40 bg-[hsl(160_62%_38%)]/5',
  muted: 'border-border bg-background',
};
const COLOR_ICON: Record<AgentColor, string> = {
  accent: 'bg-accent/15 text-accent',
  violet: 'bg-[hsl(var(--violet))]/15 text-[hsl(var(--violet))]',
  orange: 'bg-[hsl(23_90%_52%)]/15 text-[hsl(23_90%_52%)]',
  indigo: 'bg-primary/10 text-primary',
  success: 'bg-[hsl(160_62%_38%)]/15 text-[hsl(160_62%_38%)]',
  muted: 'bg-foreground/[0.06] text-foreground/70',
};
const COLOR_TIME: Record<AgentColor, string> = {
  accent: 'text-accent',
  violet: 'text-[hsl(var(--violet))]',
  orange: 'text-[hsl(23_90%_52%)]',
  indigo: 'text-primary',
  success: 'text-[hsl(160_62%_38%)]',
  muted: 'text-muted-foreground',
};

function AgentPillV({
  label,
  time,
  color,
  icon,
  className = '',
}: {
  label: string;
  time: string;
  color: AgentColor;
  icon: React.ReactNode;
  className?: string;
}) {
  const ring = COLOR_RING[color];
  const iconBox = COLOR_ICON[color];
  const timeColor = COLOR_TIME[color];
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-[7px] border px-1.5 py-[7px] ${ring} ${className}`}
    >
      <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-md ${iconBox}`}>
        {icon}
      </span>
      <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.04em] text-foreground/75">
        {label}
      </span>
      <span className={`font-mono text-[9px] ${timeColor}`}>{time}</span>
    </div>
  );
}

type TagColor = 'accent' | 'violet' | 'orange' | 'indigo' | 'success';

function FeedLine({
  time,
  tag,
  text,
  color,
  bold,
}: {
  time: string;
  tag: string;
  text: string;
  color: TagColor;
  bold?: boolean;
}) {
  const tagColor =
    color === 'accent'
      ? 'text-accent'
      : color === 'violet'
        ? 'text-[hsl(var(--violet))]'
        : color === 'orange'
          ? 'text-[hsl(23_90%_52%)]'
          : color === 'indigo'
            ? 'text-primary'
            : 'text-[hsl(160_62%_38%)]';
  return (
    <div
      className={`flex items-baseline gap-2.5 ${bold ? 'mt-1 border-t border-dashed border-border pt-1.5 font-semibold text-foreground' : ''}`}
    >
      <span className="shrink-0 text-muted-foreground/70">{time}</span>
      <span className={`shrink-0 font-semibold ${tagColor}`}>{tag}</span>
      <span className="min-w-0 flex-1 break-words">{text}</span>
    </div>
  );
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function BoltIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="h-full w-full"
    >
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="h-full w-full"
    >
      <path d="M3 3v18h18" />
      <path d="m7 14 4-4 4 4 6-6" />
    </svg>
  );
}
function CogIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="h-full w-full"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 10v6m11-11h-6M7 12H1" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="h-full w-full"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}
function SliderIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="h-full w-full"
    >
      <path d="M12 11v8m0-16v4" />
      <circle cx="12" cy="7" r="2" />
      <path d="M5 21V11m0-4V3" />
      <circle cx="5" cy="9" r="2" />
      <path d="M19 21V15m0-4V3" />
      <circle cx="19" cy="13" r="2" />
    </svg>
  );
}
function MemoryIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-full w-full"
    >
      <path d="M21.4 11.6 12.4 2.6A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .5.2 1 .6 1.4l9 9a2 2 0 0 0 2.8 0l7-7a2 2 0 0 0 0-2.8z" />
      <circle cx="7" cy="7" r="1.2" />
    </svg>
  );
}

// Agent icons — used inside AgentPillV
function LogsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-3 w-3"
    >
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}
function MetricsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-3 w-3"
    >
      <path d="M3 3v18h18" />
      <path d="m7 14 4-4 4 4 6-6" />
    </svg>
  );
}
function CodeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
function DbIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5" />
      <path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3" />
    </svg>
  );
}
function InfraIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
    >
      <rect x="2" y="3" width="20" height="5" rx="1" />
      <rect x="2" y="11" width="20" height="5" rx="1" />
      <rect x="2" y="19" width="20" height="2" rx="1" />
      <path d="M6 5.5h.01M6 13.5h.01" />
    </svg>
  );
}
function DocsIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3 w-3"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
    </svg>
  );
}

/* Unused Image import kept in file so Next can tree-shake it from bundle.
   Exported helper lets colocated test assert file integrity. */
export const _MiniDashboardImg = Image;

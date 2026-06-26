/**
 * TimeSavedSection — Dark-ink background stat block.
 * "TEMPO DO SEU TIME" — before/after comparison + 3 metrics.
 */

interface BarItem {
  label: string;
  width: string;
  value: string;
}

interface CompareCard {
  label: string;
  big: string;
  bigSub: string;
  bars: BarItem[];
}

interface Metric {
  value: string;
  unit: string;
  label: string;
  description: string;
}

interface TimeSavedSectionProps {
  eyebrow: string;
  headline: { p1: string; p2: string; em: string };
  lead: string;
  before: CompareCard;
  after: CompareCard;
  metrics: Metric[];
}

// Clean dark navy with a soft violet wash only. Teal radial was dropped per
// user directive — the teal highlights inside the stat blocks already carry
// the accent colour, so the ambient backdrop stays neutral.
const timeSavedBgStyle: React.CSSProperties = {
  background: [
    'radial-gradient(ellipse 50% 60% at 15% 90%, hsl(var(--violet) / 0.18), transparent 60%)',
    'linear-gradient(180deg, hsl(232 35% 12%) 0%, hsl(232 40% 8%) 100%)',
  ].join(','),
};

export function TimeSavedSection({
  eyebrow,
  headline,
  lead,
  before,
  after,
  metrics,
}: TimeSavedSectionProps) {
  return (
    <section
      className="relative overflow-hidden px-4 py-20 text-background sm:px-6 sm:py-24 lg:px-8 lg:py-28"
      style={timeSavedBgStyle}
    >
      <div className="relative mx-auto max-w-7xl">
        {/* Section header */}
        <div className="mx-auto mb-14 max-w-[640px] text-center">
          <p className="font-mono text-[11.5px] font-bold uppercase tracking-[0.15em] text-accent">
            {eyebrow}
          </p>
          <h2
            className="mt-4 text-balance font-display font-normal tracking-[-0.03em] text-background"
            style={{ fontSize: 'clamp(2rem, 3vw + 0.8rem, 3.2rem)', lineHeight: 1.02 }}
          >
            <span>{headline.p1}</span>
            <br />
            <span>{headline.p2} </span>
            <em className="not-italic font-medium text-accent/90">{headline.em}</em>
          </h2>
          <p className="mt-4 text-pretty text-[17px] leading-[1.55] text-background/70">{lead}</p>
        </div>

        {/* Before / After comparison */}
        <div className="mb-16 grid gap-6 sm:grid-cols-2">
          <CompareCardBlock card={before} dim />
          <CompareCardBlock card={after} dim={false} />
        </div>

        {/* Metrics row */}
        <div className="grid gap-8 border-t border-background/20 pt-12 sm:grid-cols-3">
          {metrics.map((m) => (
            <div key={m.label} className="text-center">
              <div className="font-display text-5xl font-bold tracking-tight text-background">
                <em className="not-italic text-accent">{m.value}</em>
                <span className="ml-1 text-2xl">{m.unit}</span>
              </div>
              <div className="mt-2 font-mono text-sm font-semibold uppercase tracking-wide text-background/60">
                {m.label}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-background/50">{m.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompareCardBlock({ card, dim }: { card: CompareCard; dim: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-6 ${dim ? 'border-background/10 bg-background/5' : 'border-accent/30 bg-accent/5'}`}
    >
      <div
        className={`mb-1 font-mono text-xs font-semibold uppercase tracking-widest ${dim ? 'text-background/40' : 'text-accent'}`}
      >
        {card.label}
      </div>
      <div className="font-display text-4xl font-bold text-background">{card.big}</div>
      <div className="mb-5 text-sm text-background/50">{card.bigSub}</div>
      <div className="space-y-2.5">
        {card.bars.map((bar) => (
          <div key={bar.label} className="flex items-center gap-3 text-xs">
            <span className="w-24 shrink-0 text-right text-background/50">{bar.label}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-background/10">
              <div
                className={`h-1.5 rounded-full ${dim ? 'bg-background/30' : 'bg-accent'}`}
                style={{ width: bar.width }}
              />
            </div>
            <span className="w-10 shrink-0 font-mono font-semibold text-background/70">
              {bar.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

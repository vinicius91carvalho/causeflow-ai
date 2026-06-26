/**
 * BusinessImpactCard — big-number stat card.
 *
 * Displays a hero number (estimated leads lost during the 10-minute outage),
 * a short caption, and a contextual label. Styled as a standout callout card.
 */

export interface BusinessImpactCardProps {
  stat: string;
  label: string;
  caption: string;
  /** Optional sub-note below the caption (e.g. calculation basis) */
  note?: string;
}

export function BusinessImpactCard({ stat, label, caption, note }: BusinessImpactCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border px-8 py-10 text-center sm:px-12 sm:py-14"
      style={{
        background: [
          'radial-gradient(ellipse 60% 80% at 50% 110%, hsl(var(--destructive) / 0.10), transparent 65%)',
          'hsl(var(--muted) / 0.40)',
        ].join(','),
      }}
    >
      {/* Label */}
      <p className="font-mono text-[11.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>

      {/* Hero number (stat) */}
      <p
        className="mt-3 font-display font-semibold leading-none tracking-tight text-foreground"
        style={{ fontSize: 'clamp(3rem, 8vw + 1rem, 6rem)' }}
      >
        {stat}
      </p>

      {/* Caption */}
      <p className="mx-auto mt-4 max-w-[460px] text-pretty text-[15px] leading-[1.55] text-muted-foreground">
        {caption}
      </p>

      {/* Optional sub-note */}
      {note && <p className="mt-3 font-mono text-[11px] text-muted-foreground/60">{note}</p>}

      {/* Decorative corner accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-4 h-16 w-16 rounded-full"
        style={{
          background: 'radial-gradient(circle, hsl(var(--destructive) / 0.15), transparent 70%)',
        }}
      />
    </div>
  );
}

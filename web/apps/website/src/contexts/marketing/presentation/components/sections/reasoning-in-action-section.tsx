import { AnimateOnScroll } from '@causeflow/ui/themes';
import dynamic from 'next/dynamic';

/**
 * ReasoningInActionSection — NEW section that hosts the InvestigationDashboardPreview animation.
 * Placed after CtaStopHuntingSection and before the Footer.
 */

interface ReasoningInActionSectionProps {
  eyebrow: string;
  headline: string;
  lead: string;
  /** i18n labels forwarded to the preview component */
  previewLabels: {
    rootCauseLabel: string;
    confidenceLabel: string;
    fixDescription: string;
    fixButtonLabel: string;
    processingLabel: string;
  };
}

const VizSkeleton = () => (
  <div
    aria-hidden="true"
    className="flex min-h-[380px] animate-pulse flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card/80 p-4"
  />
);

const InvestigationDashboardPreview = dynamic(
  () =>
    import(
      '@/contexts/marketing/presentation/components/sections/investigation-dashboard-preview'
    ).then((m) => ({ default: m.InvestigationDashboardPreview })),
  { loading: VizSkeleton },
);

export function ReasoningInActionSection({
  eyebrow,
  headline,
  lead,
  previewLabels,
}: ReasoningInActionSectionProps) {
  return (
    <section className="bg-background px-4 py-[110px] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        {/* Section header */}
        <div className="mx-auto mb-14 max-w-[760px] text-center">
          <p className="font-mono text-[11.5px] font-bold uppercase tracking-[0.15em] text-accent">
            {eyebrow}
          </p>
          <h2
            className="mt-4 text-balance font-display font-normal tracking-[-0.03em] text-foreground"
            style={{ fontSize: 'clamp(2rem, 3vw + 0.8rem, 3.2rem)', lineHeight: 1.02 }}
          >
            {headline}
          </h2>
          <p className="mt-4 text-pretty text-[17px] leading-[1.55] text-muted-foreground">
            {lead}
          </p>
        </div>

        {/* Animation — wrapped in a dark gradient container (user directive).
            We scope dark-mode token values to this wrapper so every child
            component (tokens: bg-card, text-foreground, border-border, ...)
            renders against the dark surface automatically — no `dark:` variant
            plumbing required in the preview component itself. */}
        <AnimateOnScroll>
          <div
            className="relative overflow-hidden rounded-3xl border border-white/10 p-8 sm:p-12"
            style={
              {
                // Teal glow rises from the TOP — brain "radiates outward".
                // Violet radial dropped per user directive (the brain viz
                // itself already carries enough colour). Diagonal linear base
                // keeps the surface distinct from CtaStopHunting.
                background: [
                  'radial-gradient(ellipse 55% 70% at 50% -10%, hsl(var(--accent) / 0.30), transparent 62%)',
                  'linear-gradient(160deg, hsl(232 38% 10%) 0%, hsl(232 42% 6%) 100%)',
                ].join(','),
                // Scoped dark-theme tokens — mirror cleric/tokens/dark.css verbatim.
                // We also override each --color-* resolved token that Tailwind v4's
                // @theme layer generates at :root, because @theme-registered
                // properties don't re-derive from nested --raw-hsl overrides.
                // Setting the resolved hsl() values directly guarantees every
                // `bg-card`, `text-foreground`, `border-border`, `text-accent`,
                // `text-success`, etc. inside this subtree renders dark.
                '--background': '232 35% 6%',
                '--foreground': '210 40% 96%',
                '--card': '232 30% 10%',
                '--card-foreground': '210 40% 96%',
                '--popover': '232 30% 10%',
                '--popover-foreground': '210 40% 96%',
                '--primary': '172 66% 50%',
                '--primary-foreground': '232 35% 6%',
                '--secondary': '232 25% 16%',
                '--secondary-foreground': '210 40% 96%',
                '--muted': '232 25% 16%',
                '--muted-foreground': '232 12% 68%',
                '--accent': '172 66% 50%',
                '--accent-foreground': '232 35% 6%',
                '--accent-tint': '172 66% 20%',
                '--warning': '23 90% 58%',
                '--warning-foreground': '0 0% 100%',
                '--destructive': '0 63% 51%',
                '--destructive-foreground': '210 40% 96%',
                '--success': '160 84% 42%',
                '--success-foreground': '210 40% 96%',
                '--border': '232 25% 18%',
                '--input': '232 25% 18%',
                '--ring': '172 66% 50%',
                '--ink-soft': '232 18% 72%',
                '--violet': '274 65% 72%',
                '--chart-1': '172 66% 50%',
                '--chart-2': '232 50% 65%',
                '--chart-3': '43 96% 66%',
                '--chart-4': '280 65% 70%',
                '--chart-5': '0 72% 61%',
                // Tailwind v4 @theme resolved tokens — must override because
                // @theme registers these at :root with inherits semantics that
                // don't pick up our nested raw overrides.
                '--color-background': 'hsl(232 35% 6%)',
                '--color-foreground': 'hsl(210 40% 96%)',
                '--color-card': 'hsl(232 30% 10%)',
                '--color-card-foreground': 'hsl(210 40% 96%)',
                '--color-popover': 'hsl(232 30% 10%)',
                '--color-popover-foreground': 'hsl(210 40% 96%)',
                '--color-primary': 'hsl(172 66% 50%)',
                '--color-primary-foreground': 'hsl(232 35% 6%)',
                '--color-secondary': 'hsl(232 25% 16%)',
                '--color-secondary-foreground': 'hsl(210 40% 96%)',
                '--color-muted': 'hsl(232 25% 16%)',
                '--color-muted-foreground': 'hsl(232 12% 68%)',
                '--color-accent': 'hsl(172 66% 50%)',
                '--color-accent-foreground': 'hsl(232 35% 6%)',
                '--color-warning': 'hsl(23 90% 58%)',
                '--color-warning-foreground': 'hsl(0 0% 100%)',
                '--color-destructive': 'hsl(0 63% 51%)',
                '--color-destructive-foreground': 'hsl(210 40% 96%)',
                '--color-success': 'hsl(160 84% 42%)',
                '--color-success-foreground': 'hsl(210 40% 96%)',
                '--color-border': 'hsl(232 25% 18%)',
                '--color-input': 'hsl(232 25% 18%)',
                '--color-ring': 'hsl(172 66% 50%)',
                '--color-chart-1': 'hsl(172 66% 50%)',
                '--color-chart-2': 'hsl(232 50% 65%)',
                '--color-chart-3': 'hsl(43 96% 66%)',
                '--color-chart-4': 'hsl(280 65% 70%)',
                '--color-chart-5': 'hsl(0 72% 61%)',
              } as React.CSSProperties
            }
          >
            <InvestigationDashboardPreview
              rootCauseLabel={previewLabels.rootCauseLabel}
              confidenceLabel={previewLabels.confidenceLabel}
              fixDescription={previewLabels.fixDescription}
              fixButtonLabel={previewLabels.fixButtonLabel}
              processingLabel={previewLabels.processingLabel}
            />
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}

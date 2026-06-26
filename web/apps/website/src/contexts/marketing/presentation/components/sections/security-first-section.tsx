/**
 * Security First / Paranoid by design — cleric-inspired clone.
 *
 * Clones HTML reference `duo-section` + scattered security callouts:
 * locks, SOC2, data-boundary, zero-retention. All tokens/semantic classes.
 */
interface SecurityPillar {
  title: string;
  description: string;
}

interface SecurityFirstSectionProps {
  eyebrow: string;
  headline: { lead: string; emphasis: string; tail?: string };
  lead: string;
  pillars: SecurityPillar[];
  badges: string[];
}

export function SecurityFirstSection({
  eyebrow,
  headline,
  lead,
  pillars,
  badges,
}: SecurityFirstSectionProps) {
  return (
    <section id="security" className="relative overflow-hidden bg-muted/40 py-20 sm:py-24 lg:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-20 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-accent/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {eyebrow}
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            <span>{headline.lead}</span>{' '}
            <em className="not-italic bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent pb-1">
              {headline.emphasis}
            </em>
            {headline.tail ? <span>{` ${headline.tail}`}</span> : null}
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {lead}
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.8"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-foreground">{pillar.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {pillar.description}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {badges.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

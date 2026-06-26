/**
 * Narrative features — "Connect. Investigate. Explain."
 *
 * Clones HTML reference `section#product` (eyebrow + 3-part headline with
 * emphasized middle + lead + 3-column feature grid). Mirrors render order
 * and spacing, uses only semantic tokens.
 */
interface FeatureItem {
  title: string;
  description: string;
}

interface NarrativeFeaturesSectionProps {
  eyebrow: string;
  headline: { connect: string; investigate: string; explain: string };
  lead: string;
  features: FeatureItem[];
}

export function NarrativeFeaturesSection({
  eyebrow,
  headline,
  lead,
  features,
}: NarrativeFeaturesSectionProps) {
  return (
    <section id="how-it-works" className="bg-background py-20 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {eyebrow}
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            <span>{headline.connect}</span>{' '}
            <em className="not-italic text-accent">{headline.investigate}</em>{' '}
            <span>{headline.explain}</span>
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {lead}
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className="group relative flex flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-accent/40"
            >
              <span className="mb-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-xs font-bold text-accent">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

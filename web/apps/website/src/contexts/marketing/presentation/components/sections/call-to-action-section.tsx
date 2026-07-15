import { Button } from '@causeflow/ui/primitives';
import { Link } from '@/i18n/navigation';

/**
 * Final CTA card — cleric-inspired clone of `section.cta-section`.
 *
 * Final CTA card — primary actions are published docs and GitHub (OSS self-host).
 */
interface CallToActionSectionProps {
  headline: { lead: string; emphasis: string; tail?: string };
  description: string;
  primaryCta: { label: string; href: string; external?: boolean };
  secondaryCta?: { label: string; href: string; external?: boolean };
}

export function CallToActionSection({
  headline,
  description,
  primaryCta,
  secondaryCta,
}: CallToActionSectionProps) {
  return (
    <section className="bg-background px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-4xl">
        <div className="relative overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/10 via-accent/5 to-background p-10 text-center sm:p-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 right-[-10%] h-64 w-64 rounded-full bg-accent/15 blur-[100px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 left-[-10%] h-64 w-64 rounded-full bg-primary/10 blur-[120px]"
          />

          <h2 className="relative text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            <span>{headline.lead}</span>{' '}
            <em className="not-italic text-accent">{headline.emphasis}</em>
            {headline.tail ? (
              <>
                <br />
                <span>{headline.tail}</span>
              </>
            ) : null}
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {description}
          </p>
          <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            {primaryCta.external ? (
              <a href={primaryCta.href} rel="noopener noreferrer">
                <Button size="lg" className="w-full sm:w-auto">
                  {primaryCta.label}
                </Button>
              </a>
            ) : (
              <Link href={primaryCta.href}>
                <Button size="lg" className="w-full sm:w-auto">
                  {primaryCta.label}
                </Button>
              </Link>
            )}
            {secondaryCta &&
              (secondaryCta.external ? (
                <a href={secondaryCta.href} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    {secondaryCta.label}
                  </Button>
                </a>
              ) : (
                <Link href={secondaryCta.href}>
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    {secondaryCta.label}
                  </Button>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}

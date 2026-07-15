import { Link } from '@/i18n/navigation';

/**
 * CtaStopHuntingSection — Final CTA card (template-faithful).
 *
 * Template reference (.cta-card):
 *   - bg: hsl(var(--ink))        → dark foreground fill
 *   - radius: 24px
 *   - padding: 80px 60px
 *   - ::before: radial-gradient(ellipse 50% 80% at 50% 120%,
 *       hsl(var(--accent) / 0.35), transparent 60%)
 *   - h2 color: hsl(var(--bg-tone)) = cream #f9f7f1
 *   - em in h2: text-accent
 *
 * OSS marketing — primary CTA is published docs; secondary is GitHub (self-host).
 */

interface CtaStopHuntingSectionProps {
  headline: { p1: string; em: string; p2: string };
  description: string;
  primaryCta: { label: string; href: string; external?: boolean };
  secondaryCta: { label: string; href: string; external?: boolean };
}

export function CtaStopHuntingSection({
  headline,
  description,
  primaryCta,
  secondaryCta,
}: CtaStopHuntingSectionProps) {
  return (
    <section className="bg-background px-4 py-[120px] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px] px-7">
        <div
          className="relative overflow-hidden rounded-3xl px-10 py-20 text-center sm:px-14 sm:py-[80px]"
          style={{
            background: [
              'radial-gradient(ellipse 50% 80% at 50% 120%, hsl(var(--accent) / 0.35), transparent 60%)',
              'radial-gradient(ellipse 40% 60% at 10% 20%, hsl(var(--violet) / 0.16), transparent 60%)',
              'linear-gradient(180deg, hsl(232 35% 12%) 0%, hsl(232 40% 8%) 100%)',
            ].join(','),
          }}
        >
          <h2
            className="relative text-balance font-display font-normal tracking-[-0.03em] text-background"
            style={{ fontSize: 'clamp(2rem, 3vw + 0.8rem, 3.2rem)', lineHeight: 1.05 }}
          >
            <span>{headline.p1} </span>
            <em className="not-italic font-medium text-accent">{headline.em}</em>
            <br />
            <span>{headline.p2}</span>
          </h2>

          <p className="relative mx-auto mt-6 max-w-[640px] text-pretty text-[17px] leading-[1.55] text-background/70">
            {description}
          </p>

          <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            {primaryCta.external ? (
              <a
                href={primaryCta.href}
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-accent px-6 text-[15px] font-semibold text-accent-foreground shadow-sm transition-all hover:-translate-y-px hover:shadow-[0_8px_22px_-6px_hsl(var(--accent)/0.5)]"
              >
                {primaryCta.label}
              </a>
            ) : (
              <Link
                href={primaryCta.href}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-accent px-6 text-[15px] font-semibold text-accent-foreground shadow-sm transition-all hover:-translate-y-px hover:shadow-[0_8px_22px_-6px_hsl(var(--accent)/0.5)]"
              >
                {primaryCta.label}
              </Link>
            )}
            {secondaryCta.external ? (
              <a
                href={secondaryCta.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-background/25 bg-transparent px-6 text-[15px] font-semibold text-background transition-all hover:border-accent hover:text-accent hover:shadow-[0_0_0_4px_hsl(var(--accent)/0.12)]"
              >
                {secondaryCta.label}
              </a>
            ) : (
              <Link
                href={secondaryCta.href}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-background/25 bg-transparent px-6 text-[15px] font-semibold text-background transition-all hover:border-accent hover:text-accent hover:shadow-[0_0_0_4px_hsl(var(--accent)/0.12)]"
              >
                {secondaryCta.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

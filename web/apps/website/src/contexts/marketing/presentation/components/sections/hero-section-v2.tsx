import { Button } from '@causeflow/ui/primitives';
import type React from 'react';
import { Link } from '@/i18n/navigation';

/**
 * Hero section — cleric-inspired clone.
 *
 * Mirrors the HTML reference `section.hero` (eyebrow pill + audience toggle +
 * large headline + lead paragraph + primary CTA + supporting visual slot).
 * Uses semantic theme tokens exclusively — no hardcoded color values.
 */
interface HeroSectionV2Props {
  eyebrow: string;
  headline: string;
  emphasis: string;
  headlineTail?: string;
  lead: string;
  primaryCta: { label: string; href: string; external?: boolean };
  secondaryCta?: { label: string; href: string };
  trustText?: string;
  children?: React.ReactNode;
}

export function HeroSectionV2({
  eyebrow,
  headline,
  emphasis,
  headlineTail,
  lead,
  primaryCta,
  secondaryCta,
  trustText,
  children,
}: HeroSectionV2Props) {
  return (
    <section className="relative overflow-hidden bg-background">
      {/* Soft ambient gradient background (accent tint + bg-tone band) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-[540px] bg-gradient-to-b from-accent/5 via-background to-background" />
        <div className="absolute -top-32 right-[10%] h-[420px] w-[420px] rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute top-1/3 -left-24 h-[360px] w-[360px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 pb-16 pt-16 text-center sm:px-6 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-28 lg:pt-24">
        {/* Eyebrow pill */}
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          {eyebrow}
        </span>

        {/* Large display headline with emphasized clause */}
        <h1 className="max-w-4xl text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
          <span>{headline}</span> <em className="not-italic text-accent">{emphasis}</em>
          {headlineTail ? <span>{` ${headlineTail}`}</span> : null}
        </h1>

        {/* Lead paragraph */}
        <p className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          {lead}
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
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
          {secondaryCta && (
            <Link href={secondaryCta.href}>
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                {secondaryCta.label}
              </Button>
            </Link>
          )}
        </div>

        {trustText && <p className="mt-6 text-xs text-muted-foreground sm:text-sm">{trustText}</p>}

        {/* Product preview slot */}
        {children && (
          <div className="mt-14 w-full max-w-4xl">
            <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-xl backdrop-blur-sm sm:p-6">
              {children}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

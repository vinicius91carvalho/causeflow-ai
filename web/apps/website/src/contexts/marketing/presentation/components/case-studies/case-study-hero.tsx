/**
 * CaseStudyHero — eyebrow, headline (+optional em), lead, meta-strip.
 *
 * Used at the top of each case study page. Sprints 02/03/04 pass
 * i18n-resolved strings; this component is purely presentational.
 */

import { MetaStrip } from './meta-strip';

export interface CaseStudyHeroProps {
  eyebrow: string;
  headline: string;
  headlineEm?: string;
  lead: string;
  meta: {
    readTimeLabel: string;
    severityLabel: string;
    impactLabel: string;
    resolvedInLabel?: string;
  };
  severity?: 'high' | 'medium' | 'low';
}

export function CaseStudyHero({
  eyebrow,
  headline,
  headlineEm,
  lead,
  meta,
  severity = 'high',
}: CaseStudyHeroProps) {
  return (
    <section
      className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8 lg:pb-24 lg:pt-20"
      style={{
        background:
          'linear-gradient(180deg, hsl(var(--muted) / 0.55) 0%, hsl(var(--muted) / 0.35) 60%, hsl(var(--background)) 100%)',
      }}
    >
      {/* Background radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: [
            'radial-gradient(ellipse 70% 50% at 80% 10%, hsl(var(--accent) / 0.10), transparent 60%)',
            'radial-gradient(ellipse 50% 40% at 15% 20%, hsl(var(--violet) / 0.06), transparent 60%)',
          ].join(','),
        }}
      />

      <div className="relative mx-auto max-w-[960px]">
        {/* Eyebrow */}
        <p className="font-mono text-[11.5px] font-bold uppercase tracking-[0.15em] text-accent">
          {eyebrow}
        </p>

        {/* Headline */}
        <h1
          className="mt-4 text-balance font-display font-normal tracking-[-0.035em] text-foreground"
          style={{ fontSize: 'clamp(2rem, 3.5vw + 0.8rem, 4rem)', lineHeight: 1.05 }}
        >
          {headlineEm ? (
            <>
              <span>{headline} </span>
              <em className="not-italic font-medium text-accent">{headlineEm}</em>
            </>
          ) : (
            headline
          )}
        </h1>

        {/* Lead */}
        <p className="mt-5 max-w-[680px] text-pretty text-[17px] leading-[1.6] text-muted-foreground sm:text-[18px]">
          {lead}
        </p>

        {/* Meta strip */}
        <div className="mt-6">
          <MetaStrip
            readTime={meta.readTimeLabel}
            severity={{ label: meta.severityLabel, tone: severity }}
            impact={meta.impactLabel}
            resolvedIn={meta.resolvedInLabel}
          />
        </div>
      </div>
    </section>
  );
}

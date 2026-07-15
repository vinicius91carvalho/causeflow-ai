import { PageLayout } from '@causeflow/ui/layouts';
import { AnimateOnScroll } from '@causeflow/ui/themes';
import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { CtaStopHuntingSection } from '@/contexts/marketing/presentation/components/sections/cta-stop-hunting-section';
import { Footer } from '@/contexts/shell/presentation/components/navigation/footer';
import { Header } from '@/contexts/shell/presentation/components/navigation/header';
import { generatePageMetadata } from '@/lib/metadata';
import { ossMarketingDocsCta, ossMarketingGitHubCta } from '@/lib/oss-marketing-ctas';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about.hero' });
  return generatePageMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: '/about',
    locale,
  });
}

type DifferentIconKind = 'shield' | 'coin' | 'bolt';

export default function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations('about');
  const tCta = useTranslations('home.newTemplate.ctaStop');

  const storyParagraphs = [0, 1, 2, 3].map((i) => t(`story.paragraphs.${i}`));
  const differentCards = [0, 1, 2].map((i) => ({
    icon: t(`different.cards.${i}.icon`) as DifferentIconKind,
    title: t(`different.cards.${i}.title`),
    description: t(`different.cards.${i}.description`),
  }));

  return (
    <PageLayout header={<Header />} footer={<Footer />}>
      {/* ═══ Hero ═══ */}
      <section
        className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-28 lg:pt-24"
        style={{
          background:
            'linear-gradient(180deg, hsl(var(--muted) / 0.55) 0%, hsl(var(--muted) / 0.45) 55%, hsl(var(--background)) 100%)',
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background: [
              'radial-gradient(ellipse 80% 50% at 85% 10%, hsl(var(--accent) / 0.10), transparent 60%)',
              'radial-gradient(ellipse 60% 40% at 15% 20%, hsl(var(--violet) / 0.06), transparent 60%)',
            ].join(','),
          }}
        />
        <div className="relative mx-auto max-w-[960px] text-center">
          <p className="font-mono text-[11.5px] font-bold uppercase tracking-[0.15em] text-accent">
            {t('hero.eyebrow')}
          </p>
          <h1
            className="mt-4 text-balance font-display font-normal tracking-[-0.035em] text-foreground"
            style={{ fontSize: 'clamp(2.4rem, 4vw + 0.8rem, 4.6rem)', lineHeight: 1.02 }}
          >
            <span>{t('hero.title')} </span>
            <em className="not-italic font-medium text-accent">{t('hero.titleEm')}</em>
          </h1>
        </div>
      </section>

      {/* ═══ Mission ═══ */}
      <section className="bg-background px-4 py-24 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
        <AnimateOnScroll>
          <div className="mx-auto max-w-[820px] text-center">
            <p className="font-mono text-[11.5px] font-bold uppercase tracking-[0.15em] text-accent">
              {t('mission.eyebrow')}
            </p>
            <figure className="relative mt-6">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-4 -left-2 font-display text-[120px] leading-none text-accent/20 sm:-top-6 sm:-left-6 sm:text-[160px]"
              >
                “
              </span>
              <blockquote className="text-pretty text-[22px] leading-[1.45] text-foreground sm:text-[26px]">
                {t('mission.body')}
              </blockquote>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-20 right-0 font-display text-[120px] leading-none text-accent/20 sm:-bottom-28 sm:-right-10 sm:text-[160px]"
              >
                ”
              </span>
            </figure>
          </div>
        </AnimateOnScroll>
      </section>

      {/* ═══ Story ═══ */}
      <section className="bg-muted/40 px-4 py-24 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-[760px]">
          <AnimateOnScroll>
            <p className="font-mono text-[11.5px] font-bold uppercase tracking-[0.15em] text-accent">
              {t('story.eyebrow')}
            </p>
            <h2
              className="mt-4 text-balance font-display font-normal tracking-[-0.03em] text-foreground"
              style={{ fontSize: 'clamp(1.9rem, 2.5vw + 0.8rem, 2.8rem)', lineHeight: 1.1 }}
            >
              <span>{t('story.title')} </span>
              <em className="not-italic font-medium text-[hsl(var(--violet))]">
                {t('story.titleEm')}
              </em>
            </h2>
          </AnimateOnScroll>
          <div className="mt-10 flex flex-col gap-6 text-[17px] leading-[1.65] text-foreground/80">
            {storyParagraphs.map((para, i) => (
              <AnimateOnScroll key={para.slice(0, 24)} delay={i * 80}>
                <p
                  className={
                    i === 1
                      ? 'rounded-xl border-l-4 border-accent/60 bg-card px-5 py-4 text-[19px] font-medium italic text-foreground shadow-[0_1px_2px_hsl(var(--foreground)/0.04)]'
                      : ''
                  }
                >
                  {para}
                </p>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Differentiators ═══ */}
      <section className="bg-background px-4 py-24 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-[1200px]">
          <AnimateOnScroll>
            <div className="mx-auto mb-14 max-w-[720px] text-center">
              <p className="font-mono text-[11.5px] font-bold uppercase tracking-[0.15em] text-accent">
                {t('different.eyebrow')}
              </p>
              <h2
                className="mt-4 text-balance font-display font-normal tracking-[-0.03em] text-foreground"
                style={{ fontSize: 'clamp(2rem, 3vw + 0.8rem, 3.2rem)', lineHeight: 1.05 }}
              >
                {t('different.title')}
              </h2>
            </div>
          </AnimateOnScroll>
          <div className="grid gap-5 md:grid-cols-3">
            {differentCards.map((card, i) => (
              <AnimateOnScroll key={card.title} delay={i * 100}>
                <article className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-[0_1px_2px_hsl(var(--foreground)/0.04)] transition-all duration-300 hover:border-accent/40 hover:shadow-[0_8px_22px_-12px_hsl(var(--accent)/0.35)]">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                      card.icon === 'shield'
                        ? 'bg-accent/10 text-accent'
                        : card.icon === 'coin'
                          ? 'bg-[hsl(var(--brand-orange))]/10 text-[hsl(var(--brand-orange))]'
                          : 'bg-[hsl(var(--violet))]/10 text-[hsl(var(--violet))]'
                    }`}
                  >
                    <DifferentIcon kind={card.icon} />
                  </span>
                  <h3 className="text-[17px] font-bold leading-[1.3] tracking-[-0.01em] text-foreground">
                    {card.title}
                  </h3>
                  <p className="text-[14.5px] leading-[1.6] text-muted-foreground">
                    {card.description}
                  </p>
                </article>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Founder ═══ */}
      <section className="bg-muted/40 px-4 py-24 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-[880px]">
          <AnimateOnScroll>
            <p className="text-center font-mono text-[11.5px] font-bold uppercase tracking-[0.15em] text-accent">
              {t('founder.eyebrow')}
            </p>
            <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.04),0_20px_60px_-30px_hsl(var(--foreground)/0.2)]">
              <div className="grid gap-8 p-8 sm:grid-cols-[160px_1fr] sm:gap-10 sm:p-10">
                {/* Monogram portrait — initials on teal gradient */}
                <div className="mx-auto flex h-40 w-40 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-[hsl(var(--violet))] font-display text-5xl font-semibold text-white shadow-inner">
                  VC
                </div>
                <div className="flex flex-col gap-3">
                  <div>
                    <h3 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
                      {t('founder.name')}
                    </h3>
                    <p className="mt-1 font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-accent">
                      {t('founder.role')}
                    </p>
                  </div>
                  <p className="text-[16px] leading-[1.6] text-muted-foreground">
                    {t('founder.bio')}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-2 font-mono text-[12px] text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                    {t('founder.location')}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <a
                      href={t('founder.linkedinUrl')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-[14px] font-semibold text-foreground transition-all hover:border-accent hover:text-accent hover:shadow-[0_0_0_4px_hsl(var(--accent)/0.08)]"
                    >
                      <LinkedinIcon />
                      {t('founder.linkedinLabel')}
                    </a>
                    <a
                      href={t('company.linkedinUrl')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-[14px] font-semibold text-muted-foreground transition-all hover:border-accent hover:text-accent hover:shadow-[0_0_0_4px_hsl(var(--accent)/0.08)]"
                    >
                      <LinkedinIcon />
                      {t('company.linkedinLabel')}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </AnimateOnScroll>
          <AnimateOnScroll delay={150}>
            <p className="mx-auto mt-10 max-w-[680px] text-center text-[16px] leading-[1.6] text-muted-foreground">
              {t('teamNote')}
            </p>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ═══ Final CTA — reuses the shared stop-hunting card ═══ */}
      <AnimateOnScroll variant="scale-up">
        <CtaStopHuntingSection
          headline={{ p1: tCta('h1'), em: tCta('em'), p2: tCta('h2') }}
          description={tCta('description')}
          primaryCta={ossMarketingDocsCta(tCta('cta1'))}
          secondaryCta={ossMarketingGitHubCta(tCta('cta2'))}
        />
      </AnimateOnScroll>
    </PageLayout>
  );
}

function DifferentIcon({ kind }: { kind: DifferentIconKind }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'h-5 w-5',
  };
  switch (kind) {
    case 'shield':
      return (
        <svg aria-hidden="true" {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'coin':
      return (
        <svg aria-hidden="true" {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10" />
          <path d="M15.5 9.5a2.5 2.5 0 0 0-2.5-1.5h-1.5a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-1.5A2.5 2.5 0 0 1 8.5 14.5" />
        </svg>
      );
    case 'bolt':
      return (
        <svg aria-hidden="true" {...common}>
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
  }
}

function LinkedinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.05-1.86-3.05-1.86 0-2.14 1.45-2.14 2.95v5.67H9.33V9h3.41v1.56h.05c.48-.9 1.64-1.86 3.38-1.86 3.61 0 4.28 2.38 4.28 5.47v6.28zM5.34 7.44a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.01H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

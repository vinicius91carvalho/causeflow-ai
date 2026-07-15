import { ROUTES } from '@causeflow/shared/constants';
import { PageLayout } from '@causeflow/ui/layouts';
import { AnimateOnScroll } from '@causeflow/ui/themes';
import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { CASE_STUDIES } from '@/contexts/marketing/domain/case-studies';
import { CtaStopHuntingSection } from '@/contexts/marketing/presentation/components/sections/cta-stop-hunting-section';
import { Footer } from '@/contexts/shell/presentation/components/navigation/footer';
import { Header } from '@/contexts/shell/presentation/components/navigation/header';
import { Link } from '@/i18n/navigation';
import { generatePageMetadata } from '@/lib/metadata';
import { ossMarketingDocsCta, ossMarketingGitHubCta } from '@/lib/oss-marketing-ctas';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'caseStudies.index' });
  return generatePageMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: ROUTES.USE_CASES,
    locale,
  });
}

export default function UseCasesIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations('caseStudies');
  const tCta = useTranslations('home.newTemplate.ctaStop');

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
            {t('index.eyebrow')}
          </p>
          <h1
            className="mt-4 text-balance font-display font-normal tracking-[-0.035em] text-foreground"
            style={{ fontSize: 'clamp(2.4rem, 4vw + 0.8rem, 4.6rem)', lineHeight: 1.02 }}
          >
            <span>{t('index.headline')} — </span>
            <em className="not-italic font-medium text-accent">{t('index.headlineEm')}</em>
          </h1>
          <p className="mx-auto mt-6 max-w-[640px] text-pretty text-[17px] leading-[1.6] text-muted-foreground sm:text-[18px]">
            {t('index.lead')}
          </p>
        </div>
      </section>

      {/* ═══ Case Study Cards ═══ */}
      <section className="bg-background px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid gap-6 md:grid-cols-3">
            {CASE_STUDIES.map((study) => {
              const title = t(`cards.${study.i18nKey}.title`);
              const summary = t(`cards.${study.i18nKey}.summary`);
              const severity = t(`cards.${study.i18nKey}.severity`);
              const duration = t(`cards.${study.i18nKey}.duration`);

              return (
                <Link
                  key={study.slug}
                  href={`${ROUTES.USE_CASES}/${study.slug}` as `/${string}`}
                  className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-[0_1px_2px_hsl(var(--foreground)/0.04)] transition-all duration-300 hover:border-accent/40 hover:shadow-[0_8px_22px_-12px_hsl(var(--accent)/0.35)]"
                >
                  {/* Eyebrow / scenario id */}
                  <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
                    {study.slug}
                  </p>

                  {/* Title */}
                  <h2 className="text-[17px] font-bold leading-[1.3] tracking-[-0.01em] text-foreground">
                    {title}
                  </h2>

                  {/* Summary */}
                  <p className="flex-1 text-[14.5px] leading-[1.6] text-muted-foreground">
                    {summary}
                  </p>

                  {/* Meta strip */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4 text-[12.5px] font-medium text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5">
                      {duration}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 ${
                        study.severity === 'high'
                          ? 'bg-red-500/10 text-red-600'
                          : study.severity === 'medium'
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-muted/40 text-muted-foreground'
                      }`}
                    >
                      {severity}
                    </span>
                  </div>

                  {/* Arrow */}
                  <span className="text-[13px] font-semibold text-accent opacity-0 transition-opacity group-hover:opacity-100">
                    {t('index.readCaseStudyCta')}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ Final CTA — reuses shared stop-hunting card ═══ */}
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

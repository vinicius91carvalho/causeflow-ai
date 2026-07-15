import { PageLayout, SectionLayout } from '@causeflow/ui/layouts';
import { AnimateOnScroll } from '@causeflow/ui/themes';
import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { CallToActionSection } from '@/contexts/marketing/presentation/components/sections/call-to-action-section';
import { FeatureCard } from '@/contexts/marketing/presentation/components/sections/feature-card';
import { HeroSection } from '@/contexts/marketing/presentation/components/sections/hero-section';
import {
  BoltIcon,
  CpuIcon,
  DocumentIcon,
} from '@/contexts/marketing/presentation/components/sections/page-icons';
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
  const t = await getTranslations({ locale, namespace: 'fromOpsgenie.meta' });

  return generatePageMetadata({
    title: t('title'),
    description: t('description'),
    path: '/from-opsgenie',
    locale,
  });
}

export default function FromOpsgeniePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations('fromOpsgenie');

  const whyCards = [
    {
      icon: <BoltIcon />,
      title: t('whyCauseflow.card1.title'),
      description: t('whyCauseflow.card1.body'),
    },
    {
      icon: <DocumentIcon />,
      title: t('whyCauseflow.card2.title'),
      description: t('whyCauseflow.card2.body'),
    },
    {
      icon: <CpuIcon />,
      title: t('whyCauseflow.card3.title'),
      description: t('whyCauseflow.card3.body'),
    },
  ];

  const timelineEvents = [
    {
      step: '1',
      label: t('timeline.event1Label'),
      date: t('timeline.event1Date'),
    },
    {
      step: '2',
      label: t('timeline.event2Label'),
      date: t('timeline.event2Date'),
    },
    {
      step: '3',
      label: t('timeline.event3Label'),
      date: t('timeline.event3Date'),
    },
  ];

  return (
    <PageLayout header={<Header />} footer={<Footer />}>
      {/* Section 1: Hero */}
      <HeroSection
        title={t('hero.title')}
        subtitle={t('hero.subtitle')}
        primaryCta={ossMarketingDocsCta(t('hero.ctaPrimary'))}
        variant="dark"
      />

      {/* Section 2: What's Happening */}
      <SectionLayout id="whats-happening">
        <AnimateOnScroll>
          <div className="mx-auto max-w-3xl">
            <p className="font-mono text-[11.5px] font-bold uppercase tracking-[0.15em] text-accent">
              {t('whatsHappening.title')}
            </p>
            <p className="mt-6 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t('whatsHappening.body')}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                {t('whatsHappening.source1Label')}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                {t('whatsHappening.source2Label')}
              </span>
            </div>
          </div>
        </AnimateOnScroll>
      </SectionLayout>

      {/* Section 3: Why CauseFlow Instead */}
      <SectionLayout variant="muted" id="why-causeflow">
        <div className="mx-auto max-w-5xl">
          <AnimateOnScroll>
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {t('whyCauseflow.title')}
            </h2>
          </AnimateOnScroll>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {whyCards.map((card, i) => (
              <AnimateOnScroll key={card.title} delay={i * 100}>
                <FeatureCard icon={card.icon} title={card.title} description={card.description} />
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </SectionLayout>

      {/* Section 4: Timeline */}
      <SectionLayout id="timeline">
        <AnimateOnScroll>
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {t('timeline.title')}
            </h2>
            <div className="mt-12 space-y-0">
              {timelineEvents.map((event, i) => (
                <div key={event.step} className="relative flex gap-4 pb-8">
                  {i < timelineEvents.length - 1 && (
                    <div className="absolute left-[19px] top-10 h-full w-0.5 bg-border" />
                  )}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {event.step}
                  </div>
                  <div className="pt-1.5">
                    <h3 className="font-semibold text-foreground">{event.label}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{event.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AnimateOnScroll>
      </SectionLayout>

      {/* Section 5: Final CTA */}
      <CallToActionSection
        headline={{
          lead: '',
          emphasis: t('finalCta.title'),
        }}
        description={t('finalCta.subtitle')}
        primaryCta={ossMarketingDocsCta(t('finalCta.ctaPrimary'))}
        secondaryCta={ossMarketingGitHubCta(t('finalCta.ctaSecondary'))}
      />
    </PageLayout>
  );
}

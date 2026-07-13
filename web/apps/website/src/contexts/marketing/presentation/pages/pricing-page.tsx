import { PRICING_PLANS, SITE } from '@causeflow/shared/constants';
import { PageLayout, SectionLayout } from '@causeflow/ui/layouts';
import { AnimateOnScroll } from '@causeflow/ui/themes';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';

import { HeroSection } from '@/contexts/marketing/presentation/components/sections/hero-section';
import type { PricingPlanRenderData } from '@/contexts/marketing/presentation/components/sections/pricing-interactive';
import { Footer } from '@/contexts/shell/presentation/components/navigation/footer';
import { Header } from '@/contexts/shell/presentation/components/navigation/header';
import { generatePageMetadata } from '@/lib/metadata';

// Skeleton placeholders to prevent CLS during dynamic import hydration
const PricingGridSkeleton = () => (
  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
    {['s1', 's2', 's3', 's4', 's5'].map((id) => (
      <div key={id} className="h-[420px] rounded-lg border bg-card animate-pulse" />
    ))}
  </div>
);

const PricingInteractive = dynamic(
  () =>
    import('@/contexts/marketing/presentation/components/sections/pricing-interactive').then(
      (m) => ({
        default: m.PricingInteractive,
      }),
    ),
  { loading: PricingGridSkeleton },
);

const ComparisonTable = dynamic(
  () =>
    import('@/contexts/marketing/presentation/components/sections/comparison-table').then((m) => ({
      default: m.ComparisonTable,
    })),
  { loading: () => <div className="h-64 animate-pulse bg-muted/10 rounded-lg" /> },
);

const FAQAccordion = dynamic(
  () =>
    import('@/contexts/marketing/presentation/components/sections/faq-accordion').then((m) => ({
      default: m.FAQAccordion,
    })),
  { loading: () => <div className="h-96 animate-pulse bg-muted/10 rounded-lg" /> },
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pricing.hero' });
  return generatePageMetadata({
    title: t('title'),
    description: t('subtitle'),
    path: '/pricing',
    locale,
  });
}

export default function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations('pricing');

  const plans: PricingPlanRenderData[] = PRICING_PLANS.map((plan) => {
    const monthlyPrice =
      typeof plan.price === 'number' ? (plan.price === 0 ? '$0' : `$${plan.price}`) : plan.price;
    const annualPrice =
      typeof plan.annualPrice === 'number'
        ? `$${plan.annualPrice}`
        : (plan.annualPrice ?? plan.price.toString());

    const descriptionParts: string[] = [];
    descriptionParts.push(`${plan.investigations} ${t('plans.investigationsIncluded')}`);
    descriptionParts.push(`${plan.events} ${t('plans.eventsIncluded')}`);

    return {
      id: plan.id,
      name: plan.name,
      displayName: t(`plans.${plan.id}`),
      priceDisplay: monthlyPrice,
      annualPriceDisplay: annualPrice,
      period: typeof plan.price === 'number' ? t('plans.perMonth') : undefined,
      annualPeriod: typeof plan.annualPrice === 'number' ? t('plans.perYear') : undefined,
      description: descriptionParts.join(' · '),
      rateLimit: plan.rateLimit,
      features: plan.features,
      cta: {
        label: plan.id === 'enterprise' ? t('oss.ctaGitHub') : t('oss.ctaSelfHost'),
        href: plan.id === 'enterprise' ? SITE.social.github : SITE.docsUrl,
        external: true,
      },
      highlighted: plan.highlighted,
      badge: plan.highlighted ? t('plans.mostPopular') : undefined,
    };
  });

  const faqItems = [
    { question: t('faq.q1.question'), answer: t('faq.q1.answer') },
    { question: t('faq.q2.question'), answer: t('faq.q2.answer') },
    { question: t('faq.q3.question'), answer: t('faq.q3.answer') },
    { question: t('faq.q4.question'), answer: t('faq.q4.answer') },
    { question: t('faq.q5.question'), answer: t('faq.q5.answer') },
    { question: t('faq.q6.question'), answer: t('faq.q6.answer') },
  ];

  const comparisonHeaders = [
    '',
    'CauseFlow AI',
    'Per-seat Tools',
    'Enterprise Platforms',
    'AI-first Tools',
  ];

  const comparisonRows = [
    {
      dimension: t('comparison.whatYouPayFor'),
      values: [
        t('comparison.causeflowPayFor'),
        t('comparison.perSeatPayFor'),
        t('comparison.platformPayFor'),
        t('comparison.enterprisePayFor'),
      ],
    },
    {
      dimension: t('comparison.scenarioTeam5'),
      values: [`$${PRICING_PLANS[0]!.price}/mo`, '$225/mo', '$100/mo', t('comparison.doesntServe')],
    },
    {
      dimension: t('comparison.scenarioTeam10'),
      values: [`$${PRICING_PLANS[0]!.price}/mo`, '$450/mo', '$200/mo', t('comparison.doesntServe')],
    },
    {
      dimension: t('comparison.scenarioTeam20'),
      values: [`$${PRICING_PLANS[1]!.price}/mo`, '$900/mo', '$400/mo', t('comparison.doesntServe')],
    },
    {
      dimension: t('comparison.scenarioTeam50'),
      values: [
        `$${PRICING_PLANS[2]!.price}/mo`,
        '$2,250/mo',
        '$1,000/mo',
        t('comparison.doesntServe'),
      ],
    },
    {
      dimension: t('comparison.customerIssues'),
      values: [
        t('comparison.included'),
        t('comparison.notAvailable'),
        t('comparison.notAvailable'),
        t('comparison.notAvailable'),
      ],
    },
  ];

  return (
    <PageLayout header={<Header />} footer={<Footer />}>
      {/* Section 1: Hero */}
      <HeroSection title={t('hero.title')} subtitle={t('hero.subtitle')} variant="dark" />

      {/* Section 2: Pricing Cards + ROI Calculator (interactive) */}
      <SectionLayout id="plans" className="pt-4 sm:pt-6 lg:pt-8">
        <AnimateOnScroll>
          <div className="mx-auto mb-10 max-w-3xl rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              {t('oss.bannerTitle')}
            </p>
            <p className="mt-2 text-muted-foreground">{t('oss.bannerBody')}</p>
          </div>
        </AnimateOnScroll>
        <PricingInteractive
          plans={plans}
          roiTitle={t('roi.title')}
          roiLabels={{
            title: t('roi.title'),
            incidents: t('roi.incidentsLabel'),
            time: t('roi.durationLabel'),
            engineers: t('roi.engineersLabel'),
            hoursSaved: t('roi.hoursSaved'),
            causeflowCost: t('roi.causeflowCost'),
            perSeatCost: t('roi.perSeatCost'),
            platformCost: t('roi.platformCost'),
            annualSavings: t('roi.annualSavings'),
          }}
        />
      </SectionLayout>

      {/* Section 3: Competitive Comparison */}
      <SectionLayout variant="muted" id="comparison">
        <AnimateOnScroll>
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {t('comparison.title')}
            </h2>
          </div>
        </AnimateOnScroll>
        <AnimateOnScroll delay={200}>
          <div className="mt-12">
            <ComparisonTable
              headers={comparisonHeaders}
              rows={comparisonRows}
              highlightColumn={1}
            />
          </div>
        </AnimateOnScroll>
      </SectionLayout>

      {/* Section 5: FAQ */}
      <SectionLayout id="faq">
        <AnimateOnScroll>
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {t('faq.title')}
            </h2>
          </div>
        </AnimateOnScroll>
        <AnimateOnScroll delay={200}>
          <div className="mx-auto mt-12 max-w-3xl">
            <FAQAccordion items={faqItems} />
          </div>
        </AnimateOnScroll>
      </SectionLayout>
    </PageLayout>
  );
}

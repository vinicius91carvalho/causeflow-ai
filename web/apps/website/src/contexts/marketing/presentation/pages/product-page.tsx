import { PageLayout, SectionLayout } from '@causeflow/ui/layouts';
import { Badge } from '@causeflow/ui/primitives';
import { AnimateOnScroll } from '@causeflow/ui/themes';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import {
  ArchitectureArrow,
  ArchitectureLayerBox,
} from '@/contexts/marketing/presentation/components/sections/architecture-layer-box';
import { HeroSection } from '@/contexts/marketing/presentation/components/sections/hero-section';
import {
  AdjustmentsIcon,
  ArrowsPointingOutIcon,
  CpuIcon,
  LinkIcon,
  RefreshIcon,
  RemediationIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TicketIcon,
} from '@/contexts/marketing/presentation/components/sections/page-icons';
import { TimelineItem } from '@/contexts/marketing/presentation/components/sections/timeline-item';
import {
  generateFAQSchema,
  StructuredData,
} from '@/contexts/marketing/presentation/components/structured-data';
import { Footer } from '@/contexts/shell/presentation/components/navigation/footer';
import { Header } from '@/contexts/shell/presentation/components/navigation/header';
import { getDashboardUrl } from '@/lib/dashboard-url';
import { generatePageMetadata } from '@/lib/metadata';

const DeploymentApproachesSection = dynamic(
  () =>
    import(
      '@/contexts/marketing/presentation/components/sections/deployment-approaches-section'
    ).then((m) => ({ default: m.DeploymentApproachesSection })),
  { loading: () => <div className="h-96 animate-pulse bg-muted/10 rounded-lg" /> },
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'product.hero' });
  return generatePageMetadata({
    title: t('title'),
    description: t('metaDescription'),
    path: '/product',
    locale,
  });
}

const phase1Steps = [
  {
    step: '1',
    titleKey: 'phases.phase1.step1.title' as const,
    descKey: 'phases.phase1.step1.description' as const,
    delay: 0,
    isLast: false,
  },
  {
    step: '2',
    titleKey: 'phases.phase1.step2.title' as const,
    descKey: 'phases.phase1.step2.description' as const,
    delay: 100,
    isLast: false,
  },
  {
    step: '3',
    titleKey: 'phases.phase1.step3.title' as const,
    descKey: 'phases.phase1.step3.description' as const,
    delay: 200,
    isLast: false,
  },
  {
    step: '4',
    titleKey: 'phases.phase1.step4.title' as const,
    descKey: 'phases.phase1.step4.description' as const,
    delay: 300,
    isLast: true,
  },
];

const phase3Cards = [
  {
    icon: <RefreshIcon />,
    title: 'Deploy Revert',
    description: 'Automatic rollback with configurable approval gates',
    delay: 0,
  },
  {
    icon: <AdjustmentsIcon />,
    title: 'Config Adjustment',
    description: 'Automatic configuration fixes with safety guardrails',
    delay: 100,
  },
  {
    icon: <ArrowsPointingOutIcon />,
    title: 'Automatic Scaling',
    description: 'Intelligent resource scaling based on investigation findings',
    delay: 200,
  },
  {
    icon: <TicketIcon />,
    title: 'L1 Ticket Resolution',
    description: 'Autonomous resolution of common support tickets',
    delay: 300,
  },
];

const architectureLayers = [
  {
    iconBg: 'bg-chart-1',
    colorClasses: 'border-chart-1 bg-chart-1/10',
    icon: <LinkIcon />,
    title: 'Connectivity Layer',
    subtitleKey: 'architecture.connectivity' as const,
    delay: 0,
  },
  {
    iconBg: 'bg-chart-4',
    colorClasses: 'border-chart-4 bg-chart-4/10',
    icon: <SparklesIcon />,
    title: 'Proprietary Core',
    subtitleKey: 'architecture.core' as const,
    delay: 150,
  },
  {
    iconBg: 'bg-chart-3',
    colorClasses: 'border-chart-3 bg-chart-3/10',
    icon: <CpuIcon />,
    title: 'LLM Gateway',
    subtitleKey: 'architecture.llm' as const,
    delay: 300,
  },
  {
    iconBg: 'bg-success',
    colorClasses: 'border-success bg-success/10',
    icon: <ShieldCheckIcon />,
    title: 'Security Layer',
    subtitleKey: 'architecture.security' as const,
    delay: 450,
  },
] as const;

export default function ProductPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations('product');
  const tFaq = useTranslations('product.faq');

  const faqItems = [
    { question: tFaq('q1.question'), answer: tFaq('q1.answer') },
    { question: tFaq('q2.question'), answer: tFaq('q2.answer') },
    { question: tFaq('q3.question'), answer: tFaq('q3.answer') },
  ];

  return (
    <PageLayout header={<Header />} footer={<Footer />}>
      <StructuredData data={generateFAQSchema(faqItems)} />
      {/* Section 1: Hero */}
      <HeroSection
        title={t('hero.title')}
        subtitle={t('hero.subtitle')}
        variant="dark"
        primaryCta={{
          label: t('hero.ctaPrimary'),
          href: getDashboardUrl(),
        }}
        secondaryCta={{
          label: t('hero.ctaSecondary'),
          href: '#demo',
        }}
      />

      {/* Section 2: Phase 1 - Assisted Investigation */}
      <SectionLayout id="phase-1">
        <div className="mx-auto max-w-3xl">
          <AnimateOnScroll>
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {t('phases.phase1.title')}
            </h2>
          </AnimateOnScroll>

          <div className="mt-12 ml-5">
            {phase1Steps.map((s) => (
              <AnimateOnScroll key={s.step} delay={s.delay}>
                <TimelineItem
                  step={s.step}
                  title={t(s.titleKey)}
                  description={t(s.descKey)}
                  isLast={s.isLast}
                />
              </AnimateOnScroll>
            ))}
          </div>

          {/* Remediation note */}
          <AnimateOnScroll delay={400}>
            <div className="mt-8 rounded-lg border border-primary/20 bg-primary/5 p-6">
              <div className="flex items-start gap-3">
                <RemediationIcon />
                <div>
                  <h3 className="font-semibold text-foreground">Semi-Autonomous Remediation</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('phases.phase1.remediation')}
                  </p>
                </div>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </SectionLayout>

      {/* Section 3: Phase 2 - Knowledge Base */}
      <SectionLayout variant="muted" id="phase-2">
        <div className="mx-auto max-w-3xl text-center">
          <AnimateOnScroll>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {t('phases.phase2.title')}
            </h2>
            <p className="mt-4 text-lg font-medium text-primary sm:text-xl">
              {t('phases.phase2.headline')}
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t('phases.phase2.description')}
            </p>
          </AnimateOnScroll>

          {/* Before/after: first vs second occurrence timeline */}
          <AnimateOnScroll delay={100}>
            <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background p-6 text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/80">
                  {t('phases.phase2.firstOccurrence.label')}
                </p>
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {t('phases.phase2.firstOccurrence.time')}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('phases.phase2.firstOccurrence.detail')}
                </p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {t('phases.phase2.secondOccurrence.label')}
                </p>
                <p className="mt-2 text-2xl font-bold text-primary">
                  {t('phases.phase2.secondOccurrence.time')}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('phases.phase2.secondOccurrence.detail')}
                </p>
              </div>
            </div>
          </AnimateOnScroll>

          {/* Mock KB entry */}
          <AnimateOnScroll delay={200}>
            <div className="mt-6 rounded-lg border border-border bg-background p-5 text-left font-mono text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/80 mb-3">
                {t('phases.phase2.kbEntry.label')}
              </p>
              <p className="font-semibold text-foreground">{t('phases.phase2.kbEntry.pattern')}</p>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>{t('phases.phase2.kbEntry.firstSeen')}</p>
                <p>{t('phases.phase2.kbEntry.recurrences')}</p>
                <p>{t('phases.phase2.kbEntry.avgResolution')}</p>
              </div>
              <p className="mt-2 text-muted-foreground">{t('phases.phase2.kbEntry.signature')}</p>
              <p className="mt-1 text-muted-foreground">{t('phases.phase2.kbEntry.fix')}</p>
              <p className="mt-3 text-xs text-muted-foreground/70">
                {t('phases.phase2.runbookNote')}
              </p>
            </div>
          </AnimateOnScroll>
        </div>
      </SectionLayout>

      {/* Section 4: Phase 3 - Autonomous Remediation (Roadmap) */}
      <SectionLayout id="phase-3">
        <div className="mx-auto max-w-3xl text-center">
          <AnimateOnScroll>
            <Badge variant="secondary" className="mb-4">
              {t('phases.phase3.badge')}
            </Badge>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {t('phases.phase3.title')}
            </h2>
            <p className="mt-4 text-lg font-medium text-primary sm:text-xl">
              {t('phases.phase3.headline')}
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t('phases.phase3.description')}
            </p>
          </AnimateOnScroll>

          {/* Roadmap features grid */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {phase3Cards.map((card) => (
              <AnimateOnScroll key={card.title} delay={card.delay}>
                <div className="group flex items-start gap-3 rounded-lg border border-border p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:bg-accent hover:border-accent hover:shadow-lg hover:shadow-accent/20">
                  <span className="mt-0.5 text-primary transition-colors duration-300 group-hover:text-accent-foreground">
                    {card.icon}
                  </span>
                  <div>
                    <h3 className="font-semibold transition-colors duration-300 group-hover:text-accent-foreground">
                      {card.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground transition-colors duration-300 group-hover:text-accent-foreground/80">
                      {card.description}
                    </p>
                  </div>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </SectionLayout>

      {/* Section 6: Architecture Diagram */}
      <SectionLayout variant="dark" id="architecture" className="pt-6 sm:pt-8 lg:pt-10">
        <div className="mx-auto max-w-4xl">
          <AnimateOnScroll>
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {t('architecture.title')}
            </h2>
          </AnimateOnScroll>

          <div className="mt-12 flex flex-col gap-4">
            {architectureLayers.map((layer, idx) => (
              <div key={layer.title}>
                <AnimateOnScroll delay={layer.delay}>
                  <ArchitectureLayerBox
                    iconBg={layer.iconBg}
                    colorClasses={layer.colorClasses}
                    icon={layer.icon}
                    title={layer.title}
                    subtitle={t(layer.subtitleKey)}
                    variant="product"
                  />
                </AnimateOnScroll>
                {idx < architectureLayers.length - 1 && <ArchitectureArrow variant="product" />}
              </div>
            ))}
          </div>
        </div>
      </SectionLayout>

      <DeploymentApproachesSection variant="detailed" />
    </PageLayout>
  );
}

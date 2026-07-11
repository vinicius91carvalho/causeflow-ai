/**
 * Homepage — template-faithful port with CauseFlow Design System tokens.
 *
 * Section order (per spec):
 *   1. HeroMainHeader          (hero + audience toggle + mini-dashboard)
 *   2. HowWorksSection         (#product — Conecta. Investiga. Explica.)
 *   3. DuoProductsSection      (AI SRE + AI Customer Ops)
 *   4. IntegrationsShowcase    (#integrations — +200 tools)
 *   5. TimeSavedSection        (dark-ink stat block)
 *   6. UseCasesCarousel        (#use-cases — INV-xxxx cards)
 *   7. AlertsInvestigation     (#alerts — 4-step flow)
 *   8. NotificationChannels    (Slack/PagerDuty/Linear previews)
 *   9. CtaStopHunting          (final CTA card)
 *  10. ReasoningInAction       (NEW — InvestigationDashboardPreview animation)
 *
 * Excluded (per spec): .logo-belt, .quote-section
 * Footer: kept as-is via <PageLayout footer={<Footer/>}>
 */

import { ROUTES } from '@causeflow/shared/constants';
import { PageLayout } from '@causeflow/ui/layouts';
import { AnimateOnScroll } from '@causeflow/ui/themes';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { AlertsInvestigationSection } from '@/contexts/marketing/presentation/components/sections/alerts-investigation-section';
import { CtaStopHuntingSection } from '@/contexts/marketing/presentation/components/sections/cta-stop-hunting-section';
import { DuoProductsSection } from '@/contexts/marketing/presentation/components/sections/duo-products-section';
import { HeroMainHeader } from '@/contexts/marketing/presentation/components/sections/hero-main-header';
import { HowWorksSection } from '@/contexts/marketing/presentation/components/sections/how-works-section';
import { MiniDashboardVisual } from '@/contexts/marketing/presentation/components/sections/mini-dashboard-visual';
import { NotificationChannelsSection } from '@/contexts/marketing/presentation/components/sections/notification-channels-section';
import { ParanoidByDesignSection } from '@/contexts/marketing/presentation/components/sections/paranoid-by-design-section';
import { ReasoningInActionSection } from '@/contexts/marketing/presentation/components/sections/reasoning-in-action-section';
import { TimeSavedSection } from '@/contexts/marketing/presentation/components/sections/time-saved-section';
import { UseCasesCarouselSection } from '@/contexts/marketing/presentation/components/sections/use-cases-carousel-section';
import {
  generateFAQSchema,
  StructuredData,
} from '@/contexts/marketing/presentation/components/structured-data';
import { Footer } from '@/contexts/shell/presentation/components/navigation/footer';
import { Header } from '@/contexts/shell/presentation/components/navigation/header';
import { getDashboardUrl } from '@/lib/dashboard-url';
import { generatePageMetadata } from '@/lib/metadata';

// ---------------------------------------------------------------------------
// Integrations carousel — kept from previous homepage (per user request)
// ---------------------------------------------------------------------------

const CarouselSkeleton = () => (
  <div aria-hidden="true" className="min-h-[140px] animate-pulse rounded-lg bg-muted/40 py-12" />
);

const TechLogoCarousel = dynamic(
  () =>
    import('@/contexts/marketing/presentation/components/sections/tech-logo-carousel').then(
      (m) => ({ default: m.TechLogoCarousel }),
    ),
  { loading: CarouselSkeleton },
);

interface LogoItem {
  name: string;
  src: string;
}

const MONITORING_LOGO_DATA: LogoItem[] = [
  { name: 'Datadog', src: '/icons/integrations/datadog.svg' },
  { name: 'PagerDuty', src: '/icons/integrations/pagerduty.svg' },
  { name: 'Sentry', src: '/icons/integrations/sentry.svg' },
  { name: 'AWS CloudWatch', src: '/icons/integrations/aws-cloudwatch.svg' },
  { name: 'Grafana', src: '/icons/integrations/grafana.svg' },
  { name: 'New Relic', src: '/icons/integrations/new-relic.svg' },
  { name: 'Splunk', src: '/icons/integrations/splunk.svg' },
  { name: 'Kubernetes', src: '/icons/integrations/kubernetes.svg' },
];

const WORKFLOW_LOGO_DATA: LogoItem[] = [
  { name: 'Slack', src: '/icons/integrations/slack.svg' },
  { name: 'GitHub', src: '/icons/integrations/github.svg' },
  { name: 'Jira', src: '/icons/integrations/jira.svg' },
  { name: 'Linear', src: '/icons/integrations/linear.svg' },
  { name: 'Notion', src: '/icons/integrations/notion.svg' },
  { name: 'HubSpot', src: '/icons/integrations/hubspot.svg' },
  { name: 'Salesforce', src: '/icons/integrations/salesforce.svg' },
  { name: 'GitLab', src: '/icons/integrations/gitlab.svg' },
  { name: 'Confluence', src: '/icons/integrations/confluence.svg' },
  { name: 'Microsoft Teams', src: '/icons/integrations/microsoft-teams.svg' },
  { name: 'ServiceNow', src: '/icons/integrations/servicenow.svg' },
];

function buildLogoIcon(item: LogoItem) {
  return {
    name: item.name,
    icon: (
      <Image
        src={item.src}
        alt={item.name}
        width={20}
        height={20}
        loading="lazy"
        decoding="async"
        className="h-5 w-5"
      />
    ),
  };
}

const MONITORING_LOGOS = MONITORING_LOGO_DATA.map(buildLogoIcon);
const WORKFLOW_LOGOS = WORKFLOW_LOGO_DATA.map(buildLogoIcon);

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home.hero' });

  return generatePageMetadata({
    title: t('headline'),
    description: t('metaDescription'),
    path: '/',
    locale,
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations('home.newTemplate');
  const tHero = useTranslations('home.hero');
  const tFaq = useTranslations('home.faq');
  const dashboardUrl = getDashboardUrl();

  const faqItems = [
    { question: tFaq('q1.question'), answer: tFaq('q1.answer') },
    { question: tFaq('q2.question'), answer: tFaq('q2.answer') },
    { question: tFaq('q3.question'), answer: tFaq('q3.answer') },
  ];

  // ── Hero dash labels ──────────────────────────────────────────────────────
  const dashLabels = {
    workspace: t('hero.dash.workspace'),
    nav1: t('hero.dash.nav1'),
    nav2: t('hero.dash.nav2'),
    nav3: t('hero.dash.nav3'),
    nav4: t('hero.dash.nav4'),
    nav5: t('hero.dash.nav5'),
    nav6: t('hero.dash.nav6'),
    investigating: t('hero.dash.investigating'),
    dashTitle: t('hero.dash.dashTitle'),
    dashSubline: t('hero.dash.dashSubline'),
    feedL1: t('hero.dash.feedL1'),
    feedL2: t('hero.dash.feedL2'),
    feedL3: t('hero.dash.feedL3'),
    feedL4: t('hero.dash.feedL4'),
    feedL5: t('hero.dash.feedL5'),
    feedL6: t('hero.dash.feedL6'),
    evidencesLabel: t('hero.dash.evidencesLabel'),
    rootCause: t('hero.dash.rootCause'),
    rcVal: t('hero.dash.rcVal'),
    rcSub: t('hero.dash.rcSub'),
    confidence: t('hero.dash.confidence'),
    evidence: t('hero.dash.evidence'),
    proposed: t('hero.dash.proposed'),
    proposedDesc: t('hero.dash.proposedDesc'),
    approve: t('hero.dash.approve'),
    details: t('hero.dash.details'),
    float1: t('hero.dash.float1'),
    float2: t('hero.dash.float2'),
  };

  // ── How-works steps ───────────────────────────────────────────────────────
  const howSteps = [0, 1, 2].map((i) => ({
    num: t(`how.steps.${i}.num`),
    numLabel: t(`how.steps.${i}.numLabel`),
    title: t(`how.steps.${i}.title`),
    description: t(`how.steps.${i}.description`),
  }));

  // ── Duo cards items ───────────────────────────────────────────────────────
  type DuoIcon = '→' | '✓';
  const sreItems = [0, 1, 2, 3].map((i) => ({
    icon: t(`duo.sre.items.${i}.icon`) as DuoIcon,
    text: t(`duo.sre.items.${i}.text`),
    mono: i === 2 ? t(`duo.sre.items.${i}.mono`) : undefined,
  }));
  const opsItems = [0, 1, 2, 3].map((i) => ({
    icon: t(`duo.ops.items.${i}.icon`) as DuoIcon,
    text: t(`duo.ops.items.${i}.text`),
    mono: i === 2 ? t(`duo.ops.items.${i}.mono`) : undefined,
  }));

  // ── Time-saved bars ───────────────────────────────────────────────────────
  const beforeBars = [0, 1, 2, 3].map((i) => ({
    label: t(`timeSaved.before.bars.${i}.label`),
    width: t(`timeSaved.before.bars.${i}.width`),
    value: t(`timeSaved.before.bars.${i}.value`),
  }));
  const afterBars = [0, 1, 2, 3].map((i) => ({
    label: t(`timeSaved.after.bars.${i}.label`),
    width: t(`timeSaved.after.bars.${i}.width`),
    value: t(`timeSaved.after.bars.${i}.value`),
  }));
  const metrics = [0, 1, 2].map((i) => ({
    value: t(`timeSaved.metrics.${i}.value`),
    unit: t(`timeSaved.metrics.${i}.unit`),
    label: t(`timeSaved.metrics.${i}.label`),
    description: t(`timeSaved.metrics.${i}.description`),
  }));

  // ── Use-case cards ────────────────────────────────────────────────────────
  type Severity = 'high' | 'medium' | 'low';
  const CASE_STUDY_HREFS: readonly (string | undefined)[] = [
    '/use-cases/stale-pricing',
    '/use-cases/broken-images',
    '/use-cases/cascading-500',
    undefined,
  ];
  const ucCards = [0, 1, 2, 3].map((i) => ({
    invId: t(`useCases.cards.${i}.invId`),
    severity: t(`useCases.cards.${i}.severity`) as Severity,
    icon: t(`useCases.cards.${i}.icon`),
    title: t(`useCases.cards.${i}.title`),
    tags: t(`useCases.cards.${i}.tags`)
      .split(',')
      .map((s: string) => s.trim()),
    rootCauseLabel: t('useCases.rootCauseLabel'),
    finding: t(`useCases.cards.${i}.finding`),
    timeToRc: t(`useCases.cards.${i}.timeToRc`),
    evidences: t(`useCases.cards.${i}.evidences`),
    confidence: t(`useCases.cards.${i}.confidence`),
    href: CASE_STUDY_HREFS[i],
  }));

  // ── Alert steps ───────────────────────────────────────────────────────────
  type AlertStatus = 'done' | 'active' | 'pending';
  const alertSteps = [0, 1, 2, 3].map((i) => ({
    title: t(`alerts.steps.${i}.title`),
    description: t(`alerts.steps.${i}.description`),
    time: t(`alerts.steps.${i}.time`),
    status: t(`alerts.steps.${i}.status`) as AlertStatus,
  }));

  // ── Notification cards ────────────────────────────────────────────────────
  const notifCards = [0, 1, 2].map((i) => {
    const hasActions = i === 0;
    return {
      icon: t(`notifications.cards.${i}.icon`),
      channel: t(`notifications.cards.${i}.channel`),
      sender: t(`notifications.cards.${i}.sender`),
      senderMeta: i === 1 ? t(`notifications.cards.${i}.senderMeta`) : undefined,
      title: t(`notifications.cards.${i}.title`),
      body: t(`notifications.cards.${i}.body`),
      actions: hasActions
        ? {
            primary: t(`notifications.cards.${i}.actions.primary`),
            secondary: t(`notifications.cards.${i}.actions.secondary`),
          }
        : undefined,
    };
  });

  return (
    <PageLayout header={<Header />} footer={<Footer />}>
      <StructuredData data={generateFAQSchema(faqItems)} />
      {/* ===== 1. Hero ===== */}
      <HeroMainHeader
        labels={{
          audEng: t('hero.audEng'),
          audOps: t('hero.audOps'),
          engH1a: t('hero.h1a'),
          engH1bEm: t('hero.h1bEm'),
          engH1bTail: t('hero.h1bTail'),
          engLead: t('hero.lead'),
          opsH1aPre: t('hero.opsH1aPre'),
          opsH1aEm: t('hero.opsH1aEm'),
          opsH1b: t('hero.opsH1b'),
          opsLead: t('hero.opsLead'),
          trust1: t('hero.trust1'),
          trust3: t('hero.trust3'),
        }}
        visual={<MiniDashboardVisual labels={dashLabels} />}
      />

      {/* AC-017 sentinel: rendered from home.hero.cta via the per-context i18n compose pipeline */}
      <span data-testid="ac-017-sentinel" className="sr-only">
        {tHero('cta')}
      </span>

      {/* ===== 2. How it works ===== */}
      <AnimateOnScroll>
        <HowWorksSection
          eyebrow={t('how.eyebrow')}
          headline={{
            s1: t('how.h1'),
            s2: t('how.h2'),
            s3: t('how.h3'),
          }}
          lead={t('how.lead')}
          steps={howSteps}
          confidenceLabel={t('how.confidence')}
        />
      </AnimateOnScroll>

      {/* ===== 3. Integrations carousel (moved between "How it works" and "Duo products") — no title ===== */}
      <TechLogoCarousel
        rows={[
          { logos: MONITORING_LOGOS, direction: 'rtl' },
          { logos: WORKFLOW_LOGOS, direction: 'ltr' },
        ]}
      />

      {/* ===== 4. Duo products ===== */}
      <AnimateOnScroll>
        <DuoProductsSection
          eyebrow={t('duo.eyebrow')}
          headline={{
            p1: t('duo.h.p1'),
            em1: t('duo.h.em1'),
            p2: t('duo.h.p2'),
            em2: t('duo.h.em2'),
            p3: t('duo.h.p3'),
          }}
          lead={t('duo.lead')}
          sreCard={{
            tag: t('duo.sre.tag'),
            title1: t('duo.sre.title1'),
            title2: t('duo.sre.title2'),
            description: t('duo.sre.description'),
            sampleLabel: t('duo.sre.sampleLabel'),
            items: sreItems,
          }}
          opsCard={{
            tag: t('duo.ops.tag'),
            title1: t('duo.ops.title1'),
            title2: t('duo.ops.title2'),
            description: t('duo.ops.description'),
            sampleLabel: t('duo.ops.sampleLabel'),
            items: opsItems,
          }}
        />
      </AnimateOnScroll>

      {/* ===== 5. Time saved (dark) ===== */}
      <AnimateOnScroll>
        <TimeSavedSection
          eyebrow={t('timeSaved.eyebrow')}
          headline={{
            p1: t('timeSaved.h1'),
            p2: t('timeSaved.h2'),
            em: t('timeSaved.em'),
          }}
          lead={t('timeSaved.lead')}
          before={{
            label: t('timeSaved.before.label'),
            big: t('timeSaved.before.big'),
            bigSub: t('timeSaved.before.bigSub'),
            bars: beforeBars,
          }}
          after={{
            label: t('timeSaved.after.label'),
            big: t('timeSaved.after.big'),
            bigSub: t('timeSaved.after.bigSub'),
            bars: afterBars,
          }}
          metrics={metrics}
        />
      </AnimateOnScroll>

      {/* ===== 6. Use cases carousel ===== */}
      <AnimateOnScroll>
        <UseCasesCarouselSection
          eyebrow={t('useCases.eyebrow')}
          headline={{ p1: t('useCases.h1'), em: t('useCases.em') }}
          prevLabel={t('useCases.prevLabel')}
          nextLabel={t('useCases.nextLabel')}
          timeLabel={t('useCases.timeLabel')}
          evLabel={t('useCases.evLabel')}
          confLabel={t('useCases.confLabel')}
          cards={ucCards}
        />
      </AnimateOnScroll>

      {/* ===== 7. Alerts investigation ===== */}
      <AnimateOnScroll>
        <AlertsInvestigationSection
          eyebrow={t('alerts.eyebrow')}
          headline={{ p1: t('alerts.h1'), em: t('alerts.em') }}
          lead={t('alerts.lead')}
          steps={alertSteps}
          sevLabels={{
            low: t('alerts.sevLabels.low'),
            medium: t('alerts.sevLabels.medium'),
            high: t('alerts.sevLabels.high'),
            critical: t('alerts.sevLabels.critical'),
          }}
        />
      </AnimateOnScroll>

      {/* ===== 8. Notification channels ===== */}
      <AnimateOnScroll>
        <NotificationChannelsSection
          eyebrow={t('notifications.eyebrow')}
          headline={{ p1: t('notifications.h1'), em: t('notifications.em') }}
          lead={t('notifications.lead')}
          cards={notifCards}
        />
      </AnimateOnScroll>

      {/* ===== 9. Reasoning in action (InvestigationDashboardPreview) — placed before CTA so emotional momentum converts ===== */}
      <ReasoningInActionSection
        eyebrow={t('reasoning.eyebrow')}
        headline={t('reasoning.headline')}
        lead={t('reasoning.lead')}
        previewLabels={{
          rootCauseLabel: tHero('vizRootCause'),
          confidenceLabel: tHero('vizConfidence'),
          fixDescription: tHero('vizFixDescription'),
          fixButtonLabel: tHero('vizFixButton'),
          processingLabel: tHero('vizProcessing'),
        }}
      />

      {/* ===== 9.5. Paranoid by design — security strip ===== */}
      <AnimateOnScroll>
        <ParanoidByDesignSection
          eyebrow={t('paranoid.eyebrow')}
          headline={{ p1: t('paranoid.h1'), em: t('paranoid.em') }}
          lead={t('paranoid.lead')}
          futureLabel={t('paranoid.futureLabel')}
          groups={[0, 1].map((gi) => ({
            title: t(`paranoid.groups.${gi}.title`),
            cards: [0, 1, 2].map((ci) => {
              const prefix = `paranoid.groups.${gi}.cards.${ci}`;
              return {
                icon: t(`${prefix}.icon`) as
                  | 'readonly'
                  | 'scope'
                  | 'approve'
                  | 'tenant'
                  | 'no-train'
                  | 'audit',
                title: t(`${prefix}.title`),
                description: t(`${prefix}.description`),
                techNote: t(`${prefix}.techNote`),
                future: t(`${prefix}.future`) === 'true',
              };
            }),
          }))}
        />
      </AnimateOnScroll>

      {/* ===== 10. CTA — stop hunting (final) ===== */}
      <AnimateOnScroll variant="scale-up">
        <CtaStopHuntingSection
          headline={{
            p1: t('ctaStop.h1'),
            em: t('ctaStop.em'),
            p2: t('ctaStop.h2'),
          }}
          description={t('ctaStop.description')}
          primaryCta={{ label: t('ctaStop.cta1'), href: `${dashboardUrl}/sign-up`, external: true }}
          secondaryCta={{ label: t('ctaStop.cta2'), href: ROUTES.PRICING }}
        />
      </AnimateOnScroll>
    </PageLayout>
  );
}

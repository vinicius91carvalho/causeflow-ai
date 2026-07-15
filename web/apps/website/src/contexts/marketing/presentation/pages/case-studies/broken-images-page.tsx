/**
 * BrokenImagesPage — Budget Clock template (Sprint 03).
 *
 * 8-section layout:
 *   1. Hero           — eyebrow / headline / lead / meta strip
 *   2. BudgetBar      — 5000 ms horizontal bar, cold-start + fetch-window segments, 3 tick marks
 *   3. ColdStartMath  — inline SVG with 3 concurrent lanes colliding with the 5000 ms wall
 *   4. CDN Dismissed  — EvidenceCard showing healthy CloudFront metrics (hypothesis eliminated)
 *   5. Self-Heal Log  — before/after CloudWatch log diff
 *   6. Fix Options    — three mitigation cards (Provisioned Concurrency / Split / Timeout)
 *   7. Root Cause     — summary + impact stat
 *   8. Final CTA      — CtaStopHuntingSection
 */

import { ROUTES } from '@causeflow/shared/constants';
import { PageLayout } from '@causeflow/ui/layouts';
import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { CaseStudyBreadcrumb } from '@/contexts/marketing/presentation/components/case-studies/case-study-breadcrumb';
import { CaseStudyHero } from '@/contexts/marketing/presentation/components/case-studies/case-study-hero';
import { EvidenceCard } from '@/contexts/marketing/presentation/components/case-studies/evidence-card';
import { BudgetBar } from '@/contexts/marketing/presentation/components/case-studies/scenario-02/budget-bar';
import { ColdStartMathSvg } from '@/contexts/marketing/presentation/components/case-studies/scenario-02/cold-start-math-svg';
import { FixOptions } from '@/contexts/marketing/presentation/components/case-studies/scenario-02/fix-options';
import { SelfHealLogDiff } from '@/contexts/marketing/presentation/components/case-studies/scenario-02/self-heal-log-diff';
import { CtaStopHuntingSection } from '@/contexts/marketing/presentation/components/sections/cta-stop-hunting-section';
import { Footer } from '@/contexts/shell/presentation/components/navigation/footer';
import { Header } from '@/contexts/shell/presentation/components/navigation/header';
import { ossMarketingDocsCta, ossMarketingGitHubCta } from '@/lib/oss-marketing-ctas';
import { generatePageMetadata } from '@/lib/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'caseStudies.brokenImages' });
  return generatePageMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: `${ROUTES.USE_CASES}/broken-images`,
    locale,
  });
}

export default function BrokenImagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations('caseStudies');
  const bi = useTranslations('caseStudies.brokenImages');

  const totalMs = Number.parseInt(bi('budgetSection.totalMs'), 10);
  const coldStartMs = Number.parseInt(bi('budgetSection.coldStartMs'), 10);
  const laneCount = Number.parseInt(bi('coldStartSection.laneCount'), 10);
  const fetchDurationMs = 2500;
  const tickStartMs = coldStartMs + 200;
  const tickSpacingMs = Math.max(120, Math.floor((totalMs - tickStartMs) / Math.max(1, laneCount)));
  const ticks = [
    { label: bi('budgetSection.tick1Label'), ms: tickStartMs },
    { label: bi('budgetSection.tick2Label'), ms: tickStartMs + tickSpacingMs },
    { label: bi('budgetSection.tick3Label'), ms: tickStartMs + tickSpacingMs * 2 },
  ];

  const cdnCardLines = bi.raw('cdnSection.cardLines') as string[];
  const beforeLines = bi.raw('logDiffSection.beforeLines') as string[];
  const afterLines = bi.raw('logDiffSection.afterLines') as string[];

  const fixOpts = [
    {
      id: 'provisioned',
      title: bi('fixSection.option1Title'),
      tradeoff: bi('fixSection.option1Tradeoff'),
      badge: bi('fixSection.option1Badge'),
    },
    {
      id: 'split',
      title: bi('fixSection.option2Title'),
      tradeoff: bi('fixSection.option2Tradeoff'),
    },
    {
      id: 'timeout',
      title: bi('fixSection.option3Title'),
      tradeoff: bi('fixSection.option3Tradeoff'),
    },
  ];

  return (
    <PageLayout header={<Header />} footer={<Footer />}>
      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <div className="px-4 pt-8 pb-6 sm:px-6 sm:pb-8 lg:px-8">
        <div className="mx-auto max-w-[960px]">
          <CaseStudyBreadcrumb
            rootLabel={t('breadcrumbRoot')}
            currentLabel={t('cards.brokenImages.title')}
          />
        </div>
      </div>

      {/* ── Section 1: Hero ───────────────────────────────────────────── */}
      <CaseStudyHero
        eyebrow={bi('hero.eyebrow')}
        headline={bi('hero.headline')}
        headlineEm={bi('hero.headlineEm')}
        lead={bi('hero.lead')}
        severity="high"
        meta={{
          readTimeLabel: bi('hero.readTimeLabel'),
          severityLabel: bi('hero.severityLabel'),
          impactLabel: bi('hero.impactLabel'),
          resolvedInLabel: bi('hero.resolvedInLabel'),
        }}
      />

      {/* ── Section 2: Budget Bar ─────────────────────────────────────── */}
      <section className="bg-background px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[960px]">
          <SectionHeading>{bi('budgetSection.title')}</SectionHeading>
          <p className="mt-3 max-w-[720px] text-[15px] leading-[1.65] text-muted-foreground">
            {bi('budgetSection.lead')}
          </p>
          <div className="mt-8">
            <BudgetBar
              totalMs={totalMs}
              coldStartMs={coldStartMs}
              ticks={ticks}
              coldStartLabel={bi('budgetSection.coldStartLabel')}
              remainingLabel={bi('budgetSection.remainingLabel')}
              budgetLabel={bi('budgetSection.budgetLabel')}
              fetchLegendLabel={bi('budgetSection.fetchLegendLabel', {
                count: laneCount,
              })}
            />
          </div>
        </div>
      </section>

      {/* ── Section 3: Cold-Start Math ────────────────────────────────── */}
      <section className="bg-muted/40 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[960px]">
          <SectionHeading>{bi('coldStartSection.title')}</SectionHeading>
          <p className="mt-3 max-w-[720px] text-[15px] leading-[1.65] text-muted-foreground">
            {bi('coldStartSection.lead')}
          </p>
          <div className="mt-8 overflow-x-auto">
            <ColdStartMathSvg
              initDurationMs={coldStartMs}
              fetchDurationMs={fetchDurationMs}
              totalBudgetMs={totalMs}
              laneCount={laneCount}
              caption={bi('coldStartSection.caption')}
              wallLabel={bi('coldStartSection.wallLabel')}
            />
          </div>
        </div>
      </section>

      {/* ── Section 4: CloudFront Hypothesis Dismissed ────────────────── */}
      <section className="bg-background px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[760px]">
          <SectionHeading>{bi('cdnSection.title')}</SectionHeading>
          <p className="mt-3 text-[15px] leading-[1.65] text-muted-foreground">
            {bi('cdnSection.lead')}
          </p>
          <div className="mt-6">
            <EvidenceCard title={bi('cdnSection.cardTitle')} lines={cdnCardLines} tone="default" />
          </div>
        </div>
      </section>

      {/* ── Section 5: Self-Heal Log Diff ─────────────────────────────── */}
      <section className="bg-muted/40 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[960px]">
          <p className="max-w-[720px] text-[15px] leading-[1.65] text-muted-foreground">
            {bi('logDiffSection.lead')}
          </p>
          <div className="mt-6">
            <SelfHealLogDiff
              sectionTitle={bi('logDiffSection.title')}
              beforeTitle={bi('logDiffSection.beforeTitle')}
              afterTitle={bi('logDiffSection.afterTitle')}
              beforeLines={beforeLines}
              afterLines={afterLines}
            />
          </div>
        </div>
      </section>

      {/* ── Section 6: Fix Options ────────────────────────────────────── */}
      <section className="bg-background px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[960px]">
          <FixOptions
            sectionTitle={bi('fixSection.title')}
            sectionLead={bi('fixSection.lead')}
            options={fixOpts}
          />
        </div>
      </section>

      {/* ── Section 7: Root Cause + Impact ────────────────────────────── */}
      <section className="bg-muted/40 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[760px]">
          <SectionHeading>{bi('rootCauseSection.title')}</SectionHeading>
          <p className="mt-4 text-[15px] leading-[1.7] text-muted-foreground">
            {bi('rootCauseSection.body')}
          </p>
          <div className="mt-6 flex flex-wrap items-baseline gap-3 rounded-xl border border-border bg-card px-5 py-4">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.15em] text-accent">
              {bi('rootCauseSection.statLabel')}
            </span>
            <span className="text-[15px] font-medium text-foreground">
              {bi('rootCauseSection.statValue')}
            </span>
          </div>
        </div>
      </section>

      {/* ── Section 8: Final CTA ───────────────────────────────────────── */}
      <CtaStopHuntingSection
        headline={{
          p1: bi('ctaSection.headlineP1'),
          em: bi('ctaSection.headlineEm'),
          p2: bi('ctaSection.headlineP2'),
        }}
        description={bi('ctaSection.description')}
        primaryCta={ossMarketingDocsCta(bi('ctaSection.primaryLabel'))}
        secondaryCta={ossMarketingGitHubCta(bi('ctaSection.secondaryLabel'))}
      />
    </PageLayout>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[1.5rem] font-normal tracking-[-0.025em] text-foreground sm:text-[1.75rem]">
      {children}
    </h2>
  );
}

/**
 * StalePricingPage — Forensic Dossier template (Sprint 02).
 *
 * 8-section layout:
 *   1. Hero        — eyebrow / headline / lead / meta strip
 *   2. Symptom     — short paragraph + timestamp badges
 *   3. Evidence    — 2×2 EvidenceBoardGrid
 *   4. Diagram     — TwoBugsDiagram (inline SVG, two red X glyphs)
 *   5. Routes      — AffectedRoutesStrip (standalone section)
 *   6. Timeline    — SymptomToRcTimeline (4 steps)
 *   7. Fix         — code blocks: before / after handler + tag note
 *   8. CTA         — CtaStopHuntingSection (reuses home keys)
 */

import { ROUTES } from '@causeflow/shared/constants';
import { PageLayout } from '@causeflow/ui/layouts';
import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { CaseStudyBreadcrumb } from '@/contexts/marketing/presentation/components/case-studies/case-study-breadcrumb';
import { CaseStudyHero } from '@/contexts/marketing/presentation/components/case-studies/case-study-hero';
import { CodeBlock } from '@/contexts/marketing/presentation/components/case-studies/code-block';
import { AffectedRoutesStrip } from '@/contexts/marketing/presentation/components/case-studies/scenario-01/affected-routes-strip';
import { EvidenceBoardGrid } from '@/contexts/marketing/presentation/components/case-studies/scenario-01/evidence-board-grid';
import { SymptomToRcTimeline } from '@/contexts/marketing/presentation/components/case-studies/scenario-01/symptom-to-rc-timeline';
import { TwoBugsDiagram } from '@/contexts/marketing/presentation/components/case-studies/scenario-01/two-bugs-diagram';
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
  const t = await getTranslations({ locale, namespace: 'caseStudies.stalePricing' });
  return generatePageMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: `${ROUTES.USE_CASES}/stale-pricing`,
    locale,
  });
}

export default function StalePricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations('caseStudies');
  const sp = useTranslations('caseStudies.stalePricing');

  return (
    <PageLayout header={<Header />} footer={<Footer />}>
      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <div className="px-4 pt-8 pb-6 sm:px-6 sm:pb-8 lg:px-8">
        <div className="mx-auto max-w-[960px]">
          <CaseStudyBreadcrumb
            rootLabel={t('breadcrumbRoot')}
            currentLabel={t('cards.stalePricing.title')}
          />
        </div>
      </div>

      {/* ── Section 1: Hero ────────────────────────────────────────────── */}
      <CaseStudyHero
        eyebrow={sp('hero.eyebrow')}
        headline={sp('hero.headline')}
        headlineEm={sp('hero.headlineEm')}
        lead={sp('hero.lead')}
        severity="high"
        meta={{
          readTimeLabel: sp('hero.readTimeLabel'),
          severityLabel: sp('hero.metaSeverity'),
          impactLabel: sp('hero.metaImpact'),
          resolvedInLabel: sp('hero.resolvedInLabel'),
        }}
      />

      {/* ── Section 2: Symptom ─────────────────────────────────────────── */}
      <section className="bg-background px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[760px]">
          <SectionHeading>{sp('symptom.heading')}</SectionHeading>
          <p className="mt-4 text-[16px] leading-[1.7] text-muted-foreground">
            {sp('symptom.body')}
          </p>
          {/* Timestamp badges */}
          <div className="mt-6 flex flex-wrap gap-3">
            <TimestampBadge>{sp('symptom.badge1')}</TimestampBadge>
            <TimestampBadge>{sp('symptom.badge2')}</TimestampBadge>
          </div>
        </div>
      </section>

      {/* ── Section 3: Evidence Board ──────────────────────────────────── */}
      <section className="bg-muted/40 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[960px]">
          <SectionHeading>{sp('evidence.heading')}</SectionHeading>
          <div className="mt-8">
            <EvidenceBoardGrid
              labels={{
                dynamo_job_title: sp('evidence.dynamoJobTitle'),
                dynamo_cache_title: sp('evidence.dynamoCacheTitle'),
                cloudwatch_title: sp('evidence.cloudwatchTitle'),
                routes_title: sp('evidence.routesTitle'),
              }}
            />
          </div>
        </div>
      </section>

      {/* ── Section 4: Data-Flow Diagram ───────────────────────────────── */}
      <section className="bg-background px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[960px]">
          <SectionHeading>{sp('diagram.heading')}</SectionHeading>
          <p className="mt-2 text-[14px] text-muted-foreground">{sp('diagram.subheading')}</p>
          <div className="mt-8">
            <TwoBugsDiagram />
          </div>
        </div>
      </section>

      {/* ── Section 5: Affected Routes ─────────────────────────────────── */}
      <section className="bg-muted/40 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[960px]">
          <SectionHeading>{sp('routesSection.heading')}</SectionHeading>
          <p className="mt-3 max-w-[640px] text-[15px] leading-[1.65] text-muted-foreground">
            {sp('routesSection.body')}
          </p>
          <div className="mt-6">
            <AffectedRoutesStrip />
          </div>
        </div>
      </section>

      {/* ── Section 6: Symptom → RC Timeline ──────────────────────────── */}
      <section className="bg-background px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[760px]">
          <SectionHeading>{sp('timeline.heading')}</SectionHeading>
          <div className="mt-8">
            <SymptomToRcTimeline
              steps={[
                {
                  label: sp('timeline.step1Label'),
                  inference: sp('timeline.step1Inference'),
                  tone: 'default',
                },
                {
                  label: sp('timeline.step2Label'),
                  inference: sp('timeline.step2Inference'),
                  tone: 'finding',
                },
                {
                  label: sp('timeline.step3Label'),
                  inference: sp('timeline.step3Inference'),
                  tone: 'finding',
                },
                {
                  label: sp('timeline.step4Label'),
                  inference: sp('timeline.step4Inference'),
                  tone: 'root-cause',
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ── Section 7: Root Cause + Fix ───────────────────────────────── */}
      <section className="bg-muted/40 px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[760px]">
          <SectionHeading>{sp('fix.heading')}</SectionHeading>

          {/* Bug 1 */}
          <div className="mt-8">
            <h3 className="text-[15px] font-semibold text-amber-600">{sp('fix.bug1Heading')}</h3>
            <p className="mt-2 text-[14.5px] leading-[1.65] text-muted-foreground">
              {sp('fix.bug1Body')}
            </p>
          </div>

          {/* Bug 2 */}
          <div className="mt-6">
            <h3 className="text-[15px] font-semibold text-red-600">{sp('fix.bug2Heading')}</h3>
            <p className="mt-2 text-[14.5px] leading-[1.65] text-muted-foreground">
              {sp('fix.bug2Body')}
            </p>
          </div>

          {/* Code blocks: before / after */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CodeBlock
              title={sp('fix.beforeLabel')}
              tone="error"
              language="javascript"
              code={`// handler (/var/task/index.js:23)
const newImage = record.dynamodb.NewImage; // crashes on DELETE events
await revalidatePath(newImage.path.S);`}
            />
            <CodeBlock
              title={sp('fix.afterLabel')}
              tone="default"
              language="javascript"
              code={`// handler (/var/task/index.js:23)
const newImage = record.dynamodb?.NewImage;
if (!newImage) return; // guard: DELETE

await revalidatePath(newImage.path.S);`}
            />
          </div>

          {/* Tag mapping note */}
          <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[13.5px] leading-[1.6] text-amber-700">
            {sp('fix.tagNote')}
          </p>
        </div>
      </section>

      {/* ── Section 7b: Outcome / Impact ──────────────────────────────── */}
      <section className="bg-background px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[760px]">
          <SectionHeading>{sp('outcome.heading')}</SectionHeading>
          <p className="mt-4 text-[15px] leading-[1.7] text-muted-foreground">
            {sp('outcome.stat')}
          </p>
          <p className="mt-3 text-[15px] font-medium leading-[1.65] text-foreground">
            {sp('outcome.withCauseflow')}
          </p>
        </div>
      </section>

      {/* ── Section 8: Final CTA ───────────────────────────────────────── */}
      <CtaStopHuntingSection
        headline={{
          p1: sp('cta.h1'),
          em: sp('cta.em'),
          p2: sp('cta.h2'),
        }}
        description={sp('cta.description')}
        primaryCta={ossMarketingDocsCta(sp('cta.cta1'))}
        secondaryCta={ossMarketingGitHubCta(sp('cta.cta2'))}
      />
    </PageLayout>
  );
}

/* ── Local helpers ────────────────────────────────────────────────────────── */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[1.5rem] font-normal tracking-[-0.025em] text-foreground sm:text-[1.75rem]">
      {children}
    </h2>
  );
}

function TimestampBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 font-mono text-[12px] text-muted-foreground">
      {children}
    </span>
  );
}

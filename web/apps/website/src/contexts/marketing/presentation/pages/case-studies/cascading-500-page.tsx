/**
 * Cascading500Page — full Cascade template.
 *
 * 7 sections:
 *   1. Hero (CaseStudyHero)
 *   2. Architecture diagram (CascadeArchitectureDiagram)
 *   3. Traffic vs errors chart (TrafficErrorChart)
 *   4. Cache records visual (CacheRecordsVisual)
 *   5. Before/after architecture (BeforeAfterArch)
 *   6. Business impact card (BusinessImpactCard)
 *   7. Root cause + fix (code snippet)
 *   8. CTA (CtaStopHuntingSection)
 *
 * No link to /get-started — the route is retired; copy refers to it narratively only.
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
import { EvidenceCard } from '@/contexts/marketing/presentation/components/case-studies/evidence-card';
import { BeforeAfterArch } from '@/contexts/marketing/presentation/components/case-studies/scenario-03/before-after-arch';
import { BusinessImpactCard } from '@/contexts/marketing/presentation/components/case-studies/scenario-03/business-impact-card';
import { CacheRecordsVisual } from '@/contexts/marketing/presentation/components/case-studies/scenario-03/cache-records-visual';
import { CascadeArchitectureDiagram } from '@/contexts/marketing/presentation/components/case-studies/scenario-03/cascade-architecture-diagram';
import { TrafficErrorChart } from '@/contexts/marketing/presentation/components/case-studies/scenario-03/traffic-error-chart';
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
  const t = await getTranslations({ locale, namespace: 'caseStudies.cascading500' });
  return generatePageMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: `${ROUTES.USE_CASES}/cascading-500`,
    locale,
  });
}

export default function Cascading500Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations('caseStudies');
  const tc = useTranslations('caseStudies.cascading500');

  return (
    <PageLayout header={<Header />} footer={<Footer />}>
      {/* Breadcrumb */}
      <div className="px-4 pt-8 pb-6 sm:px-6 sm:pb-8 lg:px-8">
        <div className="mx-auto max-w-[960px]">
          <CaseStudyBreadcrumb
            rootLabel={t('breadcrumbRoot')}
            currentLabel={t('cards.cascading500.title')}
          />
        </div>
      </div>

      {/* ── Section 1: Hero ── */}
      <CaseStudyHero
        eyebrow={tc('hero.eyebrow')}
        headline={tc('hero.headline')}
        headlineEm={tc('hero.headlineEm')}
        lead={tc('hero.lead')}
        severity="high"
        meta={{
          readTimeLabel: tc('hero.readTimeLabel'),
          severityLabel: tc('hero.severityLabel'),
          impactLabel: tc('hero.impactLabel'),
          resolvedInLabel: tc('hero.resolvedInLabel'),
        }}
      />

      {/* ── Section 2: Cascade Architecture Diagram ── */}
      <section className="bg-background px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-[960px] space-y-8">
          <SectionHeader title={tc('arch.sectionTitle')} lead={tc('arch.sectionLead')} />
          <CascadeArchitectureDiagram
            labels={{
              visitors: tc('arch.visitorsLabel'),
              cdn: tc('arch.cdnLabel'),
              lambda: tc('arch.lambdaLabel'),
              cms: tc('arch.cmsLabel'),
              hotPath: tc('arch.hotPathLabel'),
              incidentNote: tc('arch.incidentNote'),
              visitorsSub: tc('arch.visitorsSub'),
              cdnSub: tc('arch.cdnSub'),
              lambdaSub: tc('arch.lambdaSub'),
              cmsSub: tc('arch.cmsSub'),
              noCacheAnnotation: tc('arch.noCacheAnnotation'),
            }}
          />
        </div>
      </section>

      {/* ── Section 3: Traffic vs. Errors Chart ── */}
      <section className="bg-muted/20 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-[960px] space-y-8">
          <SectionHeader title={tc('chart.sectionTitle')} lead={tc('chart.sectionLead')} />
          <TrafficErrorChart
            labels={{
              title: tc('chart.title'),
              requestsLabel: tc('chart.requestsLabel'),
              errorsLabel: tc('chart.errorsLabel'),
              timeLabel: tc('chart.timeLabel'),
              linkedInSpike: tc('chart.linkedInSpike'),
              recoveryLabel: tc('chart.recoveryLabel'),
            }}
          />
          {/* Supporting CloudWatch evidence */}
          <EvidenceCard
            title="Lambda WebsiteServer — CloudWatch Logs"
            tone="error"
            lines={[
              '{"level":"error","msg":"CMS API request failed","endpoint":"https://cms.simuser.ai/api/pages/get-started","status":503,"elapsedMs":4200}',
              '{"level":"warn","msg":"CMS unavailable — no fallback cache found for path","path":"/get-started"}',
              '{"level":"error","msg":"Rendering error page","statusCode":500,"reason":"CMS_UNAVAILABLE","path":"/get-started"}',
            ]}
          />
        </div>
      </section>

      {/* ── Section 4: Cache Records Visual ── */}
      <section className="bg-background px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-[960px] space-y-8">
          <SectionHeader title={tc('cache.sectionTitle')} lead={tc('cache.sectionLead')} />
          <CacheRecordsVisual
            labels={{
              title: tc('cache.title'),
              pathLabel: tc('cache.pathLabel'),
              revalidatedAtLabel: tc('cache.revalidatedAtLabel'),
              findingLabel: tc('cache.findingLabel'),
              findingDescription: tc('cache.findingDescription'),
              rowCount: tc('cache.rowCount'),
            }}
          />
        </div>
      </section>

      {/* ── Section 5: Before / After Architecture ── */}
      <section className="bg-muted/20 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-[960px] space-y-8">
          <SectionHeader
            title={tc('beforeAfter.sectionTitle')}
            lead={tc('beforeAfter.sectionLead')}
          />
          <BeforeAfterArch
            labels={{
              beforeLabel: tc('beforeAfter.beforeLabel'),
              afterLabel: tc('beforeAfter.afterLabel'),
              beforeSubtitle: tc('beforeAfter.beforeSubtitle'),
              afterSubtitle: tc('beforeAfter.afterSubtitle'),
              ssrLabel: tc('beforeAfter.ssrLabel'),
              isrLabel: tc('beforeAfter.isrLabel'),
              lambdaLabel: tc('beforeAfter.lambdaLabel'),
              cmsLabel: tc('beforeAfter.cmsLabel'),
              cacheLabel: tc('beforeAfter.cacheLabel'),
              fallbackLabel: tc('beforeAfter.fallbackLabel'),
              noCacheAnnotation: tc('beforeAfter.noCacheAnnotation'),
              singlePointOfFailure: tc('beforeAfter.singlePointOfFailure'),
              revalidateAnnotation: tc('beforeAfter.revalidateAnnotation'),
            }}
          />
        </div>
      </section>

      {/* ── Section 6: Business Impact Card ── */}
      <section className="bg-background px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-[760px] space-y-8">
          <SectionHeader title={tc('impact.sectionTitle')} lead="" />
          <BusinessImpactCard
            stat={tc('impact.stat')}
            label={tc('impact.statLabel')}
            caption={tc('impact.statCaption')}
            note={tc('impact.statNote')}
          />
        </div>
      </section>

      {/* ── Section 7: Root Cause + Fix (code snippet) ── */}
      <section className="bg-muted/20 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-[960px] space-y-8">
          <SectionHeader title={tc('rootCause.sectionTitle')} lead={tc('rootCause.sectionLead')} />

          <div className="space-y-4">
            {/* Before: SSR — direct CMS fetch, no cache */}
            <CodeBlock
              title={tc('rootCause.beforeCodeTitle')}
              tone="error"
              language="typescript"
              code={`// pages/get-started — SSR: fetch on every request
export default async function GetStartedPage() {
  const content = await fetch('https://cms.simuser.ai/api/pages/get-started')
    .then(r => r.json());
  // CMS 503 → this throws → Next renders 500 to the user
  return <PageContent data={content} />;
}`}
            />

            {/* After: ISR + fallback */}
            <CodeBlock
              title={tc('rootCause.afterCodeTitle')}
              tone="default"
              language="typescript"
              code={`// ISR — cached for 5 min, tolerant to CMS outages
export const revalidate = 300; // 5 minutes

export default async function GetStartedPage() {
  const content = await fetchWithFallback();
  return <PageContent data={content} />;
}

async function fetchWithFallback() {
  try {
    const res = await fetch('https://cms.simuser.ai/api/pages/get-started', {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(\`CMS returned \${res.status}\`);
    return await res.json();
  } catch (err) {
    console.error({ msg: 'CMS fetch failed — serving stale cache', err });
    return null; // Next.js serves ISR cache automatically
  }
}`}
            />
          </div>
        </div>
      </section>

      {/* ── Section 8: Final CTA ── */}
      <CtaStopHuntingSection
        headline={{
          p1: tc('cta.headlineP1'),
          em: tc('cta.headlineEm'),
          p2: tc('cta.headlineP2'),
        }}
        description={tc('cta.description')}
        primaryCta={ossMarketingDocsCta(tc('cta.primaryLabel'))}
        secondaryCta={ossMarketingGitHubCta(tc('cta.secondaryLabel'))}
      />
    </PageLayout>
  );
}

/* ── Internal helper ── */

function SectionHeader({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="space-y-3">
      <h2 className="font-display text-[1.5rem] font-normal tracking-[-0.025em] text-foreground sm:text-[1.75rem]">
        {title}
      </h2>
      {lead && (
        <p className="max-w-[680px] text-pretty text-[16px] leading-[1.6] text-muted-foreground">
          {lead}
        </p>
      )}
    </div>
  );
}

import { PageLayout, SectionLayout } from '@causeflow/ui/layouts';
import { AnimateOnScroll } from '@causeflow/ui/themes';
import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { CallToActionSection } from '@/contexts/marketing/presentation/components/sections/call-to-action-section';
import { DeploymentApproachesSection } from '@/contexts/marketing/presentation/components/sections/deployment-approaches-section';
import {
  BlockIcon,
  CheckBadgeIcon,
  DatabaseIcon,
  EyeOffIcon,
  KeyIcon,
  LinkIcon,
  ShieldCheckIcon,
  ShieldIcon,
} from '@/contexts/marketing/presentation/components/sections/page-icons';
import { ParanoidByDesignSection } from '@/contexts/marketing/presentation/components/sections/paranoid-by-design-section';
import { SecurityHeroSection } from '@/contexts/marketing/presentation/components/sections/security-hero-section';
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
  const t = await getTranslations({ locale, namespace: 'security.hero' });

  return generatePageMetadata({
    title: t('title'),
    description: t('subtitle'),
    path: '/security',
    locale,
  });
}

const bedrockCards = [
  { icon: <BlockIcon />, textKey: 'bedrock.noTraining', delay: 100 },
  { icon: <EyeOffIcon />, textKey: 'bedrock.zeroAccess', delay: 200 },
  { icon: <CheckBadgeIcon />, textKey: 'bedrock.iso', delay: 300 },
  { icon: <LinkIcon />, textKey: 'bedrock.privateLink', delay: 400 },
  { icon: <ShieldIcon />, textKey: 'bedrock.guardrails', delay: 500 },
] as const;

export default function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations('security');
  const tCta = useTranslations('common.cta');
  const tParanoid = useTranslations('home.newTemplate.paranoid');

  const isolationLayers = [
    { layer: 'Application', detail: t('isolation.application') },
    { layer: 'Database', detail: t('isolation.database') },
    { layer: 'Vector DB', detail: t('isolation.vectorDb') },
    { layer: 'Infrastructure', detail: t('isolation.infrastructure') },
    { layer: 'PII Gateway', detail: t('isolation.piiGateway') },
    { layer: 'Encryption', detail: t('isolation.encryption') },
  ];

  return (
    <PageLayout header={<Header />} footer={<Footer />}>
      {/* Section 1: Hero */}
      <SecurityHeroSection
        title={t('hero.title')}
        subtitle={t('hero.subtitle')}
        primaryCta={ossMarketingDocsCta(tCta('readDocs'))}
        secondaryCta={ossMarketingGitHubCta(tCta('viewOnGitHub'))}
      />

      {/* Shared "Paranoid by design" summary — same content as homepage for brand coherence */}
      <AnimateOnScroll>
        <ParanoidByDesignSection
          eyebrow={tParanoid('eyebrow')}
          headline={{ p1: tParanoid('h1'), em: tParanoid('em') }}
          lead={tParanoid('lead')}
          futureLabel={tParanoid('futureLabel')}
          groups={[0, 1].map((gi) => ({
            title: tParanoid(`groups.${gi}.title`),
            cards: [0, 1, 2].map((ci) => {
              const prefix = `groups.${gi}.cards.${ci}`;
              let future = false;
              try {
                future = tParanoid(`${prefix}.future`) === 'true';
              } catch {
                future = false;
              }
              return {
                icon: tParanoid(`${prefix}.icon`) as
                  | 'readonly'
                  | 'scope'
                  | 'approve'
                  | 'tenant'
                  | 'no-train'
                  | 'audit',
                title: tParanoid(`${prefix}.title`),
                description: tParanoid(`${prefix}.description`),
                techNote: tParanoid(`${prefix}.techNote`),
                future,
              };
            }),
          }))}
        />
      </AnimateOnScroll>

      <DeploymentApproachesSection variant="security" />

      {/* Section 4: Integration Security — separate from CauseFlow platform compliance */}
      <SectionLayout id="integration-security">
        <div className="mx-auto max-w-5xl">
          <AnimateOnScroll>
            <div className="mb-2 flex items-center justify-center gap-2">
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Integration Infrastructure
              </span>
            </div>
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {t('integrationSecurity.title')}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
              {t('integrationSecurity.subtitle')}
            </p>
          </AnimateOnScroll>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                { key: 'soc2', icon: <CheckBadgeIcon /> },
                { key: 'iso27001', icon: <ShieldCheckIcon /> },
                { key: 'oauth2', icon: <KeyIcon /> },
                { key: 'encryptedCredentials', icon: <ShieldIcon /> },
                { key: 'readOnly', icon: <EyeOffIcon /> },
                { key: 'tenantIsolation', icon: <DatabaseIcon /> },
              ] as const
            ).map(({ key, icon }, idx) => (
              <AnimateOnScroll key={key} delay={(idx + 1) * 100}>
                <div className="group h-full rounded-lg border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-accent hover:border-accent hover:shadow-lg hover:shadow-accent/20">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-accent-foreground/20 group-hover:text-accent-foreground">
                    {icon}
                  </div>
                  <h3 className="font-semibold transition-colors duration-300 group-hover:text-accent-foreground">
                    {t(`integrationSecurity.${key}.title`)}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground transition-colors duration-300 group-hover:text-accent-foreground/80">
                    {t(`integrationSecurity.${key}.description`)}
                  </p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </SectionLayout>

      {/* Section 6: Data Isolation (Multi-tenancy) */}
      <SectionLayout id="isolation">
        <div className="mx-auto max-w-4xl">
          <AnimateOnScroll>
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {t('isolation.title')}
            </h2>
          </AnimateOnScroll>
          <AnimateOnScroll delay={200}>
            <div className="mt-12 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-sm font-semibold text-foreground">Layer</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground">
                      Isolation Mechanism
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isolationLayers.map((item) => (
                    <tr key={item.layer} className="border-b border-border">
                      <td className="px-4 py-4 font-medium">{item.layer}</td>
                      <td className="px-4 py-4 text-sm text-muted-foreground">{item.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AnimateOnScroll>
        </div>
      </SectionLayout>

      {/* Section 7: AWS Bedrock as LLM Provider */}
      <SectionLayout variant="muted" id="bedrock">
        <div className="mx-auto max-w-4xl">
          <AnimateOnScroll>
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {t('bedrock.title')}
            </h2>
          </AnimateOnScroll>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {bedrockCards.map((card) => (
              <AnimateOnScroll key={card.textKey} delay={card.delay}>
                <div className="group rounded-lg border border-border bg-background p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-accent hover:border-accent hover:shadow-lg hover:shadow-accent/20">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-accent-foreground/20 group-hover:text-accent-foreground">
                    {card.icon}
                  </div>
                  <h3 className="font-semibold transition-colors duration-300 group-hover:text-accent-foreground">
                    {t(card.textKey)}
                  </h3>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </SectionLayout>

      {/* Section 8: Final CTA */}
      <AnimateOnScroll variant="scale-up">
        <CallToActionSection
          headline={{
            lead: t('hero.title'),
            emphasis: t('cta.ctaPrimary') ?? 'Open dashboard',
          }}
          description={t('hero.subtitle')}
          primaryCta={ossMarketingDocsCta(tCta('readDocs'))}
          secondaryCta={ossMarketingGitHubCta(tCta('viewOnGitHub'))}
        />
      </AnimateOnScroll>
    </PageLayout>
  );
}

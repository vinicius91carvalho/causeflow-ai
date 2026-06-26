import { INTEGRATIONS } from '@causeflow/shared/constants';
import { PageLayout, SectionLayout } from '@causeflow/ui/layouts';
import { AnimateOnScroll } from '@causeflow/ui/themes';
import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { FeatureCard } from '@/contexts/marketing/presentation/components/sections/feature-card';
import { HeroSection } from '@/contexts/marketing/presentation/components/sections/hero-section';
import { IntegrationFilter } from '@/contexts/marketing/presentation/components/sections/integration-filter';
import {
  IntArrowsIcon,
  IntBoltIcon,
  IntCodeIcon,
  IntEyeIcon,
  IntShieldIcon,
} from '@/contexts/marketing/presentation/components/sections/integration-icons';
import { Footer } from '@/contexts/shell/presentation/components/navigation/footer';
import { Header } from '@/contexts/shell/presentation/components/navigation/header';
import { generatePageMetadata } from '@/lib/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'integrations.hero' });

  return generatePageMetadata({
    title: t('title'),
    description: t('subtitle'),
    path: '/integrations',
    locale,
  });
}

export default function IntegrationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);

  const t = useTranslations('integrations');

  const categoryLabels: Record<string, string> = {
    all: t('categories.all'),
    monitoring: t('categories.monitoring'),
    communication: t('categories.communication'),
    code: t('categories.code'),
    management: t('categories.management'),
    knowledge: t('categories.knowledge'),
    crm: t('categories.crm'),
    database: t('categories.database'),
    cloud: t('categories.cloud'),
    'ci-cd': t('categories.ciCd'),
    api: t('categories.api'),
  };

  return (
    <PageLayout header={<Header />} footer={<Footer />}>
      {/* Section 1: Hero */}
      <HeroSection title={t('hero.title')} subtitle={t('hero.subtitle')} variant="dark" />

      {/* Section 2: Filterable Integration Catalog */}
      <SectionLayout id="catalog">
        <AnimateOnScroll>
          <h2 className="sr-only">{t('catalog.title')}</h2>
          <IntegrationFilter
            integrations={INTEGRATIONS}
            categoryLabels={categoryLabels}
            andMoreLabel={t('catalog.andMore')}
            andMoreDescription={t('catalog.andMoreDescription')}
          />
        </AnimateOnScroll>
      </SectionLayout>

      {/* Section 3: Integration Security */}
      <SectionLayout variant="muted" id="security">
        <div className="mx-auto max-w-5xl">
          <AnimateOnScroll>
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {t('security.title')}
            </h2>
            <p className="mt-3 text-center text-sm text-muted-foreground sm:text-base">
              {t('security.description')}
            </p>
          </AnimateOnScroll>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AnimateOnScroll delay={0}>
              <FeatureCard
                icon={<IntShieldIcon />}
                title={t('security.soc2Title')}
                description={t('security.soc2Description')}
              />
            </AnimateOnScroll>
            <AnimateOnScroll delay={100}>
              <FeatureCard
                icon={<IntShieldIcon />}
                title={t('security.iso27001Title')}
                description={t('security.iso27001Description')}
              />
            </AnimateOnScroll>
            <AnimateOnScroll delay={200}>
              <FeatureCard
                icon={<IntBoltIcon />}
                title={t('security.oauthTitle')}
                description={t('security.oauthDescription')}
              />
            </AnimateOnScroll>
            <AnimateOnScroll delay={300}>
              <FeatureCard
                icon={<IntCodeIcon />}
                title={t('security.encryptionTitle')}
                description={t('security.encryptionDescription')}
              />
            </AnimateOnScroll>
            <AnimateOnScroll delay={400}>
              <FeatureCard
                icon={<IntEyeIcon />}
                title={t('security.readOnlyTitle')}
                description={t('security.readOnlyDescription')}
              />
            </AnimateOnScroll>
            <AnimateOnScroll delay={500}>
              <FeatureCard
                icon={<IntArrowsIcon />}
                title={t('security.tenantIsolationTitle')}
                description={t('security.tenantIsolationDescription')}
              />
            </AnimateOnScroll>
          </div>
        </div>
      </SectionLayout>
    </PageLayout>
  );
}

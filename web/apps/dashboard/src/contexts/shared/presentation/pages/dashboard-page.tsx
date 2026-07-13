import { PageHeader } from '@causeflow/ui/layouts';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DashboardOverview } from '@/contexts/shared/presentation/components/dashboard-overview';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.overview' });
  return { title: t('title') };
}

export default async function OverviewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'dashboard' });

  const messages = {
    metrics: {
      totalAnalyses: t('home.metrics.totalAnalyses'),
      activeIntegrations: t('home.metrics.activeIntegrations'),
      teamMembers: t('home.metrics.teamMembers'),
    },
    emptyState: {
      title: t('home.emptyState.title'),
      subtitle: t('home.emptyState.subtitle'),
      createAnalysis: t('home.emptyState.createAnalysis'),
      feature1: t('home.emptyState.feature1'),
      feature2: t('home.emptyState.feature2'),
      feature3: t('home.emptyState.feature3'),
      branchA: {
        title: t('home.emptyState.branchA.title'),
        subtitle: t('home.emptyState.branchA.subtitle'),
        connectIntegration: t('home.emptyState.branchA.connectIntegration'),
        setUpRelay: t('home.emptyState.branchA.setUpRelay'),
        feature1: t('home.emptyState.feature1'),
        feature2: t('home.emptyState.feature2'),
        feature3: t('home.emptyState.feature3'),
      },
      branchB: {
        title: t('home.emptyState.branchB.title'),
        subtitle: t('home.emptyState.branchB.subtitle'),
        createFirstAnalysis: t('home.emptyState.branchB.createFirstAnalysis'),
        feature1: t('home.emptyState.feature1'),
        feature2: t('home.emptyState.feature2'),
        feature3: t('home.emptyState.feature3'),
      },
    },
    newAnalysis: t('home.systemOperational.newAnalysis'),
  } as const;

  return (
    <div className="space-y-6">
      <PageHeader title={t('overview.title')} description={t('overview.description')} />
      <DashboardOverview messages={messages} />
    </div>
  );
}

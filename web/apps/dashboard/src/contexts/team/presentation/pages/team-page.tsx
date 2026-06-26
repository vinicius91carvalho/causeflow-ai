import { PageHeader } from '@causeflow/ui/layouts';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TeamPageClient } from '@/contexts/team/presentation/components/team-page-client';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.team' });
  return { title: t('title') };
}

export default async function TeamPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'dashboard.team' });

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />
      <TeamPageClient />
    </div>
  );
}

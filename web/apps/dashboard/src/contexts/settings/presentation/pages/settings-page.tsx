import { PageHeader } from '@causeflow/ui/layouts';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SettingsPage } from '@/contexts/settings/presentation/components/settings-content';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.settings' });
  return { title: t('title') };
}

export default async function SettingsRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'dashboard.settings' });

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />
      <SettingsPage />
    </div>
  );
}

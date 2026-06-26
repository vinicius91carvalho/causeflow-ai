import { PageHeader } from '@causeflow/ui/layouts';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuditList } from '@/contexts/audit/presentation/components/audit-list';

// Audit log requires live data — no caching
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.audit' });
  return { title: t('title') };
}

export default async function AuditPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'dashboard.audit' });

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      {/* Audit list with filters and pagination */}
      <AuditList />
    </div>
  );
}

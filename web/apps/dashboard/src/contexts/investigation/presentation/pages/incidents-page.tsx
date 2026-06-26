import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { IncidentsList } from '@/contexts/investigation/presentation/components/incidents-list';
import { Link } from '@/i18n/navigation';

// This page renders client-side data fetching components — mark as dynamic
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.incidents' });
  return { title: t('title') };
}

export default async function IncidentsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'dashboard.incidents' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{t('title')}</h2>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Link
          href="/dashboard/incidents/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors self-start sm:self-auto"
        >
          + {t('newIncident')}
        </Link>
      </div>

      {/* List with filters and pagination */}
      <IncidentsList />
    </div>
  );
}

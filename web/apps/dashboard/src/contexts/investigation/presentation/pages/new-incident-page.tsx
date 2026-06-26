import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NewIncidentForm } from '@/contexts/investigation/presentation/components/new-incident-form';
import { Link } from '@/i18n/navigation';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.incidents.new' });
  return { title: t('title') };
}

export default async function NewIncidentPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'dashboard.incidents' });
  const tNew = await getTranslations({ locale, namespace: 'dashboard.incidents.new' });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/dashboard/incidents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {t('title')}
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{tNew('title')}</h2>
        <p className="text-muted-foreground">{tNew('description')}</p>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <NewIncidentForm />
      </div>
    </div>
  );
}

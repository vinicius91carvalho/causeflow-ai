import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { IncidentDetail } from '@/contexts/investigation/presentation/components/incident-detail';
import { getServerTenantId } from '@/lib/auth/get-server-auth';
import { getApiClient } from '@/lib/api/get-api-client';

// This page fetches user-specific data at request time — cannot be statically pre-rendered
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.incidents' });
  return { title: t('detail.title') };
}

export default async function IncidentDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const orgId = await getServerTenantId();
  if (!orgId) {
    notFound();
  }

  try {
    const client = getApiClient();
    const incident = await client.getIncident(id);
    return <IncidentDetail initialIncident={incident} />;
  } catch {
    notFound();
  }
}

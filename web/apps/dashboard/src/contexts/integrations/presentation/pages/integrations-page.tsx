import { PageHeader } from '@causeflow/ui/layouts';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { IntegrationsClient } from '@/contexts/integrations/presentation/components/integrations-client';
import { IntegrationsToastHandler } from '@/contexts/integrations/presentation/components/integrations-toast-handler';
import { getServerTenantId } from '@/lib/auth/get-server-auth';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.integrations' });
  return { title: t('title') };
}

/**
 * Derives the Sentry webhook URL from the tenant's org id.
 *
 * NEVER built from a request body or query — the tenantId is the
 * organization id from the JWT cookie. Falls back to staging for local dev
 * when `CORE_API_URL` is unset.
 */
function buildSentryWebhookUrl(orgId: string | null | undefined): string {
  const baseUrl = process.env.CORE_API_URL ?? 'https://api-staging.causeflow.ai';
  // If no org context (shouldn't happen for an authenticated route), use a
  // visible placeholder so the user can see the URL shape but the modal
  // submit guard will still prevent saving without a Client Secret.
  const tenantId = orgId ?? '<your-tenant-id>';
  return `${baseUrl}/v1/webhooks/${tenantId}/sentry`;
}

export default async function IntegrationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'dashboard.integrations' });
  const orgId = await getServerTenantId();
  const sentryWebhookUrl = buildSentryWebhookUrl(orgId);

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      {/* Fires toast on ?connected / ?connect_error params from Composio redirect flow */}
      <IntegrationsToastHandler />

      {/* Client component handles fetch, filter, search, modals */}
      <IntegrationsClient sentryWebhookUrl={sentryWebhookUrl} />
    </div>
  );
}

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';

/**
 * Client sub-component rendered inside IntegrationsPage (server component).
 *
 * On mount it checks for ?connected=<provider> or ?connect_error=<message>
 * search params written by the Composio OAuth callback redirect, fires the
 * matching toast, then strips the params from the URL via router.replace so
 * a page refresh does not re-fire the toast.
 */
export function IntegrationsToastHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addToast } = useToast();
  const t = useTranslations('dashboard.integrations');

  useEffect(() => {
    const connected = searchParams.get('connected');
    const connectError = searchParams.get('connect_error');

    if (connected) {
      addToast(t('connectedToast', { provider: connected }), 'success');
      router.replace('/dashboard/integrations');
    } else if (connectError) {
      addToast(t('connectErrorToast', { message: connectError }), 'error');
      router.replace('/dashboard/integrations');
    }
  }, [searchParams, addToast, t, router]);

  return null;
}

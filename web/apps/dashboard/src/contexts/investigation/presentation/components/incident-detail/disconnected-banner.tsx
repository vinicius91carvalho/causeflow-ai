'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DisconnectedBannerProps } from '@/contexts/investigation/domain/incident-stream-types';

/**
 * Surfaces the SSE stream connection state to the user.
 *
 * Renders nothing while connected. While connecting, shows a quiet loading
 * pill (no Retry — connection is in flight). On `disconnected` or `error`,
 * shows an amber alert with an explicit Retry button. There is no automatic
 * reconnect — clicking Retry calls `onReconnect`.
 */
export function DisconnectedBanner({ status, onReconnect }: DisconnectedBannerProps) {
  const t = useTranslations('dashboard.incidents.detail.stream');

  if (status === 'connected') {
    return null;
  }

  if (status === 'connecting') {
    return (
      <output
        aria-live="polite"
        className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {t('connecting')}
      </output>
    );
  }

  const message = status === 'error' ? t('error') : t('disconnected');

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"
    >
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{message}</span>
      <button
        type="button"
        onClick={onReconnect}
        className="ml-auto inline-flex items-center rounded-md border border-warning/60 bg-warning/10 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/15 transition-colors dark:hover:bg-warning/80"
      >
        {t('reconnect')}
      </button>
    </div>
  );
}

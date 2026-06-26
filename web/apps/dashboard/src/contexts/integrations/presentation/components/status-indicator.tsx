'use client';

import { useTranslations } from 'next-intl';
import type { IntegrationStatus } from '@/contexts/integrations/domain/types';

interface StatusIndicatorProps {
  status: IntegrationStatus;
  errorMessage?: string;
  className?: string;
}

/**
 * Status indicator dot for an integration card.
 * Connected: green dot
 * Error: red dot with pulsing animation
 * Disconnected: gray dot
 */
export function StatusIndicator({ status, errorMessage, className }: StatusIndicatorProps) {
  const t = useTranslations('dashboard.integrations.status');

  const dotColors: Record<IntegrationStatus, string> = {
    connected: 'bg-success/50',
    error: 'bg-destructive/50',
    disconnected: 'bg-muted',
  };

  const labels: Record<IntegrationStatus, string> = {
    connected: t('connected'),
    error: t('error'),
    disconnected: t('disconnected'),
  };

  const title = status === 'error' && errorMessage ? errorMessage : labels[status];

  return (
    <output
      className={['inline-flex items-center gap-1.5', className].filter(Boolean).join(' ')}
      title={title}
      aria-label={labels[status]}
    >
      <span
        className={[
          'h-2 w-2 rounded-full shrink-0',
          dotColors[status],
          status === 'error' ? 'animate-pulse' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden="true"
      />
      <span className="text-xs font-medium text-muted-foreground">{labels[status]}</span>
    </output>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import type { SentryIntegrationStatus } from '@/contexts/integrations/domain/types';

export interface SentryStatusPillProps {
  status: SentryIntegrationStatus;
  /** Optional override for `Date.now()` — used in tests for stable output. */
  now?: () => Date;
}

/**
 * Three states:
 * - `setup_required` — no client secret saved yet (`hasClientSecret === false`)
 *   → "Setup required" (warning tone)
 * - `awaiting`       — secret saved but not yet verified (`hasClientSecret === true && verified === false`)
 *   → "Awaiting first event" (info tone)
 * - `verified`       — `verified === true`
 *   → "Verified — last event {relative time}" (success tone)
 *
 * Visual conventions match `IntegrationCard` pills (rounded-full, bg-tone/10,
 * text-tone). No raw HSL values.
 */
export function SentryStatusPill({ status, now }: SentryStatusPillProps) {
  const t = useTranslations('dashboard.integrations.sentryStatus');

  const state = deriveState(status);

  let label: string;
  let toneClass: string;

  switch (state) {
    case 'setup_required':
      label = t('setupRequired');
      toneClass = 'bg-warning/10 text-warning border-warning/30';
      break;
    case 'awaiting':
      label = t('awaiting');
      toneClass = 'bg-primary/10 text-primary border-primary/30';
      break;
    case 'verified': {
      const relative = formatRelativeOrNever(status.lastEventAt, now ?? (() => new Date()));
      label = relative
        ? t('verified', { time: relative })
        : `${t('verifiedNoEvent')} — ${t('neverEvent')}`;
      toneClass = 'bg-success/10 text-success border-success/30';
      break;
    }
  }

  return (
    <span
      data-testid="sentry-status-pill"
      data-state={state}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneClass}`}
    >
      {label}
    </span>
  );
}

type SentryPillState = 'setup_required' | 'awaiting' | 'verified';

function deriveState(status: SentryIntegrationStatus): SentryPillState {
  if (!status.hasClientSecret) return 'setup_required';
  if (status.verified) return 'verified';
  return 'awaiting';
}

/**
 * Returns a coarse relative-time string: "just now", "5m ago", "3h ago", "2d ago".
 * Returns `null` when `iso` is null — caller decides how to render that.
 */
function formatRelativeOrNever(iso: string | null, now: () => Date): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;

  const diffMs = now().getTime() - then;
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

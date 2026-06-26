'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useIsStaff } from '@/contexts/identity/presentation/hooks/use-is-staff';
import type { Incident } from '@/contexts/investigation/domain/types';
import {
  type InvestigationModeName,
  InvestigationModeSelector,
} from './investigation-mode-selector';

interface IncidentActionBarProps {
  incident: Incident;
  isRerunning: boolean;
  isTriaging: boolean;
  isInvestigating: boolean;
  isAborting: boolean;
  showAbortConfirm: boolean;
  onRerun: () => void;
  onStartTriage: () => void;
  onStartInvestigation: () => void;
  onStartInvestigationWithMode: (mode: InvestigationModeName) => void;
  onAbortRequest: () => void;
  onAbortConfirm: () => void;
  onAbortCancel: () => void;
}

/**
 * Pure presentational action bar for the incident detail page.
 *
 * Receives all handlers + state via props — no fetch, no local state. The
 * parent (`IncidentDetail`) keeps ownership of the action handlers because
 * they need access to the same `fetchIncident` callback the SSE-driven
 * effect uses.
 */
export function IncidentActionBar({
  incident,
  isRerunning,
  isTriaging,
  isInvestigating,
  isAborting,
  showAbortConfirm,
  onRerun,
  onStartTriage,
  onStartInvestigation,
  onStartInvestigationWithMode,
  onAbortRequest,
  onAbortConfirm,
  onAbortCancel,
}: IncidentActionBarProps) {
  const t = useTranslations('dashboard.incidents.detail');
  const isStaff = useIsStaff();

  if (incident.status === 'open') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onStartTriage}
          disabled={isTriaging}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed /50 dark:hover:bg-primary/80"
        >
          {isTriaging ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {t('actions.starting')}
            </>
          ) : (
            t('actions.startTriage')
          )}
        </button>
        <button
          type="button"
          onClick={onStartInvestigation}
          disabled={isInvestigating}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isInvestigating ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {t('actions.starting')}
            </>
          ) : (
            t('actions.startInvestigation')
          )}
        </button>
        {isStaff && (
          <InvestigationModeSelector
            onRun={onStartInvestigationWithMode}
            isRunning={isInvestigating}
          />
        )}
      </div>
    );
  }

  if (incident.status === 'investigating') {
    return (
      <div className="flex">
        {!showAbortConfirm ? (
          <button
            type="button"
            onClick={onAbortRequest}
            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors /50 dark:hover:bg-destructive/80"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            {t('actions.abortInvestigation')}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 /50">
            <p className="text-sm text-destructive">{t('actions.abortConfirm')}</p>
            <button
              type="button"
              onClick={onAbortConfirm}
              disabled={isAborting}
              className="inline-flex items-center gap-1 rounded-md bg-destructive/80 px-3 py-1 text-xs font-semibold text-white hover:bg-destructive/80 disabled:opacity-60"
            >
              {isAborting ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
              {isAborting ? t('actions.aborting') : t('actions.abortYes')}
            </button>
            <button
              type="button"
              onClick={onAbortCancel}
              className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-accent"
            >
              {t('actions.abortCancel')}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (incident.status === 'resolved' || incident.status === 'closed') {
    return (
      <button
        type="button"
        onClick={onRerun}
        disabled={isRerunning}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isRerunning ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            {t('actions.creating')}
          </>
        ) : (
          <>+ {t('rerun')}</>
        )}
      </button>
    );
  }

  return null;
}

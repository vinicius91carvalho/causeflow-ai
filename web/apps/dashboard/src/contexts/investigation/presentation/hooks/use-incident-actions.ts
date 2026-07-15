'use client';

/**
 * useIncidentActions — encapsulates the POST handlers + per-action loading
 * state for the incident detail page so the page component itself stays
 * focused on layout.
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import type { Incident } from '@/contexts/investigation/domain/types';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';

export interface UseIncidentActionsResult {
  isRerunning: boolean;
  isTriaging: boolean;
  isInvestigating: boolean;
  isAborting: boolean;
  showAbortConfirm: boolean;
  setShowAbortConfirm: (value: boolean) => void;
  handleRerun: () => Promise<void>;
  handleStartTriage: () => Promise<void>;
  handleStartInvestigation: () => Promise<void>;
  /** Staff-only — stamps a reasoning mode then triggers investigation. */
  handleStartInvestigationWithMode: (
    mode: 'orchestrator' | 'hypothesis' | 'debate',
  ) => Promise<void>;
  handleAbortInvestigation: () => Promise<void>;
  handleKnownSolutionResponse: (response: 'accepted' | 'declined') => Promise<void>;
}

interface UseIncidentActionsArgs {
  incident: Incident;
  refresh: () => Promise<void>;
}

export function useIncidentActions({
  incident,
  refresh,
}: UseIncidentActionsArgs): UseIncidentActionsResult {
  const t = useTranslations('dashboard.incidents.detail');
  const { addToast } = useToast();
  const router = useRouter();
  const [isRerunning, setIsRerunning] = useState(false);
  const [isTriaging, setIsTriaging] = useState(false);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [isAborting, setIsAborting] = useState(false);
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);

  const handleRerun = useCallback(async () => {
    setIsRerunning(true);
    try {
      const res = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: incident.title,
          description: incident.description,
          severity: incident.severity,
          sourceProvider: incident.sourceProvider,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        addToast(err.error ?? t('rerunFailed'), 'error');
        return;
      }
      const data = (await res.json()) as { incidentId?: string; incident?: Incident };
      const id = data.incidentId ?? data.incident?.incidentId;
      if (id) router.push(`/dashboard/incidents/${id}`);
    } catch {
      addToast(t('rerunFailed'), 'error');
    } finally {
      setIsRerunning(false);
    }
  }, [incident, addToast, router, t]);

  const handleStartTriage = useCallback(async () => {
    setIsTriaging(true);
    try {
      const res = await fetch(`/api/analyses/${encodeURIComponent(incident.incidentId)}/triage`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        addToast(err.error ?? t('actions.triageFailed'), 'error');
        return;
      }
      addToast(t('actions.triageStarted'), 'success');
      await refresh();
    } catch {
      addToast(t('actions.triageFailed'), 'error');
    } finally {
      setIsTriaging(false);
    }
  }, [incident.incidentId, addToast, t, refresh]);

  const handleStartInvestigation = useCallback(async () => {
    setIsInvestigating(true);
    try {
      const res = await fetch(
        `/api/analyses/${encodeURIComponent(incident.incidentId)}/investigate`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        addToast(err.error ?? t('actions.investigationFailed'), 'error');
        return;
      }
      addToast(t('actions.investigationStarted'), 'success');
      await refresh();
    } catch {
      addToast(t('actions.investigationFailed'), 'error');
    } finally {
      setIsInvestigating(false);
    }
  }, [incident.incidentId, addToast, t, refresh]);

  /**
   * Staff-only: stamp a reasoning mode on the incident and trigger
   * investigation. Fails silently for non-staff because the BFF route
   * 403s — no UI leak (the selector is also gated via `useIsStaff`).
   */
  const handleStartInvestigationWithMode = useCallback(
    async (mode: 'orchestrator' | 'hypothesis' | 'debate') => {
      setIsInvestigating(true);
      try {
        const res = await fetch(
          `/api/admin/incidents/${encodeURIComponent(incident.incidentId)}/run`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode }),
          },
        );
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          addToast(err.error ?? t('actions.investigationFailed'), 'error');
          return;
        }
        addToast(t('actions.investigationStarted'), 'success');
        await refresh();
      } catch {
        addToast(t('actions.investigationFailed'), 'error');
      } finally {
        setIsInvestigating(false);
      }
    },
    [incident.incidentId, addToast, t, refresh],
  );

  const handleAbortInvestigation = useCallback(async () => {
    setIsAborting(true);
    try {
      const res = await fetch(
        `/api/analyses/${encodeURIComponent(incident.incidentId)}/investigate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ abort: true }),
        },
      );
      if (!res.ok) {
        addToast(t('actions.abortFailed'), 'error');
        return;
      }
      addToast(t('actions.investigationAborted'), 'success');
      await refresh();
    } catch {
      addToast(t('actions.abortFailed'), 'error');
    } finally {
      setIsAborting(false);
    }
  }, [incident.incidentId, addToast, t, refresh]);

  const handleKnownSolutionResponse = useCallback(
    async (response: 'accepted' | 'declined') => {
      try {
        const res = await fetch(
          `/api/investigation/${encodeURIComponent(incident.incidentId)}/known-solution-response`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ response }),
          },
        );
        if (!res.ok) {
          addToast(t('knownSolution.failed'), 'error');
          return;
        }
        addToast(
          response === 'accepted' ? t('knownSolution.accepted') : t('knownSolution.declined'),
          'success',
        );
        await refresh();
      } catch {
        addToast(t('knownSolution.failed'), 'error');
      }
    },
    [incident.incidentId, addToast, t, refresh],
  );

  return {
    isRerunning,
    isTriaging,
    isInvestigating,
    isAborting,
    showAbortConfirm,
    setShowAbortConfirm,
    handleRerun,
    handleStartTriage,
    handleStartInvestigation,
    handleStartInvestigationWithMode,
    handleAbortInvestigation,
    handleKnownSolutionResponse,
  };
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OnboardingProgress, StepKey } from '../../domain/types';
import { OnboardingRepository } from '../../infrastructure/onboarding-repository';

const repo = new OnboardingRepository();

export interface UseOnboardingProgressReturn {
  progress: OnboardingProgress | null;
  loading: boolean;
  startOnboarding: () => void;
  resetOnboarding: () => void;
  completeStep: (step: StepKey) => void;
  skipStep: (step: StepKey) => void;
  skipAll: () => void;
  completeOnboarding: () => void;
}

/**
 * Hook for reading and mutating onboarding progress.
 * Uses localStorage via OnboardingRepository with optimistic local state.
 */
export function useOnboardingProgress(): UseOnboardingProgressReturn {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const existing = repo.getProgress();
    setProgress(existing);
    setLoading(false);
  }, []);

  const startOnboarding = useCallback(() => {
    const existing = repo.getProgress();
    if (existing) {
      setProgress(existing);
      return;
    }
    const created = repo.createProgress();
    setProgress(created);
  }, []);

  const resetOnboarding = useCallback(() => {
    const reset = repo.resetProgress();
    setProgress(reset);
  }, []);

  const completeStep = useCallback((step: StepKey) => {
    try {
      const updated = repo.updateStepStatus(step, 'completed');

      // Auto-complete if all action steps done
      const actionSteps = [
        'welcome',
        'integrations',
        'relay',
        'firstIncident',
        'receiveEvents',
        'billing',
      ] as const;
      const allDone = actionSteps.every(
        (s) => updated.steps[s] === 'completed' || updated.steps[s] === 'skipped',
      );

      if (allDone && !updated.completed) {
        const completed = repo.completeOnboarding();
        setProgress(completed);
      } else {
        setProgress(updated);
      }
    } catch {
      // No progress found — ignore
    }
  }, []);

  const skipStep = useCallback((step: StepKey) => {
    try {
      const updated = repo.updateStepStatus(step, 'skipped');
      setProgress(updated);
    } catch {
      // No progress found — ignore
    }
  }, []);

  const skipAll = useCallback(() => {
    try {
      const skipped = repo.skipOnboarding();
      setProgress(skipped);
    } catch {
      // No progress found — ignore
    }
  }, []);

  const completeOnboardingAction = useCallback(() => {
    try {
      const completed = repo.completeOnboarding();
      setProgress(completed);
    } catch {
      // No progress found — ignore
    }
  }, []);

  return {
    progress,
    loading,
    startOnboarding,
    resetOnboarding,
    completeStep,
    skipStep,
    skipAll,
    completeOnboarding: completeOnboardingAction,
  };
}

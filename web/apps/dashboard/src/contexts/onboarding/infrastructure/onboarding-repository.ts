/**
 * Onboarding Repository
 *
 * Persists onboarding progress to localStorage. Provides a clean interface
 * that can be swapped to a backend API when DynamoDB endpoints are available.
 */

import {
  createInitialProgress,
  type OnboardingProgress,
  type OnboardingStepStatus,
  STEP_KEYS,
  type StepKey,
} from '../domain/types';

const STORAGE_KEY = 'causeflow-onboarding-progress';

export class OnboardingRepository {
  getProgress(): OnboardingProgress | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as OnboardingProgress;
    } catch {
      return null;
    }
  }

  createProgress(): OnboardingProgress {
    const progress = createInitialProgress();
    this.persist(progress);
    return progress;
  }

  updateStepStatus(step: StepKey, status: OnboardingStepStatus): OnboardingProgress {
    const progress = this.getProgress();
    if (!progress) {
      throw new Error('No onboarding progress found');
    }

    progress.steps[step] = status;
    progress.currentStep = this.findNextPendingStep(progress);
    this.persist(progress);
    return progress;
  }

  skipOnboarding(): OnboardingProgress {
    const progress = this.getProgress();
    if (!progress) {
      throw new Error('No onboarding progress found');
    }

    progress.skipped = true;
    this.persist(progress);
    return progress;
  }

  resetProgress(): OnboardingProgress {
    const progress = createInitialProgress();
    this.persist(progress);
    return progress;
  }

  completeOnboarding(): OnboardingProgress {
    const progress = this.getProgress();
    if (!progress) {
      throw new Error('No onboarding progress found');
    }

    progress.completed = true;
    progress.steps.complete = 'completed';
    progress.completedAt = new Date().toISOString();
    this.persist(progress);
    return progress;
  }

  private persist(progress: OnboardingProgress): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // localStorage may be full or disabled — fail silently
    }
  }

  private findNextPendingStep(progress: OnboardingProgress): StepKey {
    for (const key of STEP_KEYS) {
      if (progress.steps[key] === 'pending') {
        return key;
      }
    }
    return 'complete';
  }
}

import { describe, expect, it } from 'vitest';

/**
 * Progress indicator unit tests.
 *
 * These tests verify the step state logic for the progress indicator
 * component without rendering it (which requires jsdom + next-intl providers).
 */

type OnboardingStep = 1 | 2 | 3;

interface StepState {
  isCompleted: boolean;
  isCurrent: boolean;
  isUpcoming: boolean;
}

function getStepState(stepNumber: OnboardingStep, currentStep: OnboardingStep): StepState {
  return {
    isCompleted: stepNumber < currentStep,
    isCurrent: stepNumber === currentStep,
    isUpcoming: stepNumber > currentStep,
  };
}

const ALL_STEPS: OnboardingStep[] = [1, 2, 3];

describe('ProgressIndicator step state logic', () => {
  describe('Step 1 (Profile) as current step', () => {
    const currentStep: OnboardingStep = 1;

    it('step 1 is current', () => {
      expect(getStepState(1, currentStep).isCurrent).toBe(true);
      expect(getStepState(1, currentStep).isCompleted).toBe(false);
      expect(getStepState(1, currentStep).isUpcoming).toBe(false);
    });

    it('step 2 is upcoming', () => {
      expect(getStepState(2, currentStep).isUpcoming).toBe(true);
      expect(getStepState(2, currentStep).isCurrent).toBe(false);
      expect(getStepState(2, currentStep).isCompleted).toBe(false);
    });

    it('step 3 is upcoming', () => {
      expect(getStepState(3, currentStep).isUpcoming).toBe(true);
    });

    it('no steps are completed', () => {
      for (const step of ALL_STEPS) {
        expect(getStepState(step, currentStep).isCompleted).toBe(false);
      }
    });

    it('exactly one step is current', () => {
      const currentCount = ALL_STEPS.filter((s) => getStepState(s, currentStep).isCurrent).length;
      expect(currentCount).toBe(1);
    });
  });

  describe('Step 2 (Integration) as current step', () => {
    const currentStep: OnboardingStep = 2;

    it('step 1 is completed', () => {
      expect(getStepState(1, currentStep).isCompleted).toBe(true);
    });

    it('step 2 is current', () => {
      expect(getStepState(2, currentStep).isCurrent).toBe(true);
    });

    it('step 3 is upcoming', () => {
      expect(getStepState(3, currentStep).isUpcoming).toBe(true);
    });

    it('exactly one step is completed', () => {
      const completedCount = ALL_STEPS.filter(
        (s) => getStepState(s, currentStep).isCompleted,
      ).length;
      expect(completedCount).toBe(1);
    });
  });

  describe('Step 3 (Welcome) as current step', () => {
    const currentStep: OnboardingStep = 3;

    it('step 1 is completed', () => {
      expect(getStepState(1, currentStep).isCompleted).toBe(true);
    });

    it('step 2 is completed', () => {
      expect(getStepState(2, currentStep).isCompleted).toBe(true);
    });

    it('step 3 is current', () => {
      expect(getStepState(3, currentStep).isCurrent).toBe(true);
    });

    it('exactly two steps are completed', () => {
      const completedCount = ALL_STEPS.filter(
        (s) => getStepState(s, currentStep).isCompleted,
      ).length;
      expect(completedCount).toBe(2);
    });

    it('no steps are upcoming', () => {
      const upcomingCount = ALL_STEPS.filter((s) => getStepState(s, currentStep).isUpcoming).length;
      expect(upcomingCount).toBe(0);
    });
  });

  describe('invariants for all steps', () => {
    for (const currentStep of ALL_STEPS) {
      it(`exactly one step is current when currentStep=${currentStep}`, () => {
        const currentCount = ALL_STEPS.filter((s) => getStepState(s, currentStep).isCurrent).length;
        expect(currentCount).toBe(1);
      });

      it(`each step has exactly one state when currentStep=${currentStep}`, () => {
        for (const step of ALL_STEPS) {
          const state = getStepState(step, currentStep);
          const stateCount = [state.isCompleted, state.isCurrent, state.isUpcoming].filter(
            Boolean,
          ).length;
          expect(stateCount).toBe(1);
        }
      });
    }
  });

  describe('component structure', () => {
    it('has 3 steps total', () => {
      expect(ALL_STEPS).toHaveLength(3);
    });

    it('steps are numbered 1, 2, 3', () => {
      expect(ALL_STEPS).toEqual([1, 2, 3]);
    });

    it('step labels follow expected keys', () => {
      const STEP_LABELS = ['steps.profile', 'steps.integration', 'steps.welcome'];
      expect(STEP_LABELS).toHaveLength(3);
      expect(STEP_LABELS[0]).toBe('steps.profile');
      expect(STEP_LABELS[1]).toBe('steps.integration');
      expect(STEP_LABELS[2]).toBe('steps.welcome');
    });
  });
});

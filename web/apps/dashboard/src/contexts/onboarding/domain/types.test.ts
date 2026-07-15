import { describe, expect, it } from 'vitest';
import {
  createInitialProgress,
  getTutorialSteps,
  type OnboardingProgress,
  type OnboardingStepStatus,
  STEP_CONFIG,
  STEP_KEYS,
  TUTORIAL_STEPS,
} from './types';

describe('Onboarding Domain Types', () => {
  it('omits billing step in OSS tutorial flow (AC-083)', () => {
    const ossSteps = getTutorialSteps(true);
    expect(ossSteps.map((s) => s.key)).not.toContain('billing');
    expect(ossSteps).toHaveLength(TUTORIAL_STEPS.length - 1);
    expect(getTutorialSteps(false)).toEqual(TUTORIAL_STEPS);
  });

  it('defines all step keys', () => {
    expect(STEP_KEYS).toEqual([
      'welcome',
      'integrations',
      'relay',
      'firstIncident',
      'receiveEvents',
      'billing',
      'complete',
    ]);
  });

  it('has config for every step key', () => {
    for (const key of STEP_KEYS) {
      expect(STEP_CONFIG[key]).toBeDefined();
      expect(STEP_CONFIG[key].href).toBeDefined();
      expect(STEP_CONFIG[key].labelKey).toBeDefined();
      expect(STEP_CONFIG[key].icon).toBeDefined();
    }
  });

  it('creates initial progress with all steps pending', () => {
    const progress = createInitialProgress();

    expect(progress.completed).toBe(false);
    expect(progress.skipped).toBe(false);
    expect(progress.currentStep).toBe('welcome');

    for (const key of STEP_KEYS) {
      expect(progress.steps[key]).toBe('pending');
    }
  });

  it('step config hrefs point to valid dashboard routes', () => {
    for (const key of STEP_KEYS) {
      const config = STEP_CONFIG[key];
      // welcome and complete don't navigate
      if (key === 'welcome' || key === 'complete') {
        expect(config.href).toBe('');
      } else {
        expect(config.href).toMatch(/^\/dashboard\//);
      }
    }
  });

  it('supports all step statuses', () => {
    const statuses: OnboardingStepStatus[] = ['pending', 'completed', 'skipped'];
    expect(statuses).toHaveLength(3);
  });

  it('OnboardingProgress shape is correct', () => {
    const progress: OnboardingProgress = {
      steps: {
        welcome: 'completed',
        integrations: 'pending',
        relay: 'pending',
        firstIncident: 'pending',
        receiveEvents: 'pending',
        billing: 'pending',
        complete: 'pending',
      },
      currentStep: 'integrations',
      completed: false,
      skipped: false,
      startedAt: '2026-04-06T12:00:00Z',
    };

    expect(progress.steps.welcome).toBe('completed');
    expect(progress.currentStep).toBe('integrations');
  });
});

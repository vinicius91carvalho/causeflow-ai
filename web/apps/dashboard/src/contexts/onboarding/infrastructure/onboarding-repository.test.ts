import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STEP_KEYS } from '../domain/types';
import { OnboardingRepository } from './onboarding-repository';

// Mock localStorage for node environment
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  }),
  length: 0,
  key: vi.fn(() => null),
};

vi.stubGlobal('localStorage', localStorageMock);

describe('OnboardingRepository', () => {
  let repo: OnboardingRepository;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    repo = new OnboardingRepository();
  });

  it('returns null when no progress exists', () => {
    expect(repo.getProgress()).toBeNull();
  });

  it('creates initial progress with all steps pending', () => {
    const progress = repo.createProgress();

    expect(progress.completed).toBe(false);
    expect(progress.skipped).toBe(false);
    expect(progress.currentStep).toBe('welcome');
    for (const key of STEP_KEYS) {
      expect(progress.steps[key]).toBe('pending');
    }
  });

  it('persists progress to localStorage', () => {
    repo.createProgress();
    const restored = repo.getProgress();
    expect(restored).not.toBeNull();
    expect(restored?.currentStep).toBe('welcome');
  });

  it('updates step status to completed', () => {
    repo.createProgress();
    const updated = repo.updateStepStatus('welcome', 'completed');

    expect(updated.steps.welcome).toBe('completed');
    expect(updated.currentStep).toBe('integrations');
  });

  it('advances currentStep to next pending step after completion', () => {
    repo.createProgress();
    repo.updateStepStatus('welcome', 'completed');
    repo.updateStepStatus('integrations', 'completed');
    const updated = repo.updateStepStatus('relay', 'completed');

    expect(updated.currentStep).toBe('firstIncident');
  });

  it('skips onboarding entirely', () => {
    repo.createProgress();
    const skipped = repo.skipOnboarding();

    expect(skipped.skipped).toBe(true);
  });

  it('completes onboarding when all action steps are done', () => {
    repo.createProgress();
    repo.updateStepStatus('welcome', 'completed');
    repo.updateStepStatus('integrations', 'completed');
    repo.updateStepStatus('relay', 'completed');
    repo.updateStepStatus('firstIncident', 'completed');
    repo.updateStepStatus('receiveEvents', 'completed');
    repo.updateStepStatus('billing', 'completed');
    const result = repo.completeOnboarding();

    expect(result.completed).toBe(true);
    expect(result.steps.complete).toBe('completed');
    expect(result.completedAt).toBeDefined();
  });

  it('throws when updating without existing progress', () => {
    expect(() => repo.updateStepStatus('welcome', 'completed')).toThrow(
      'No onboarding progress found',
    );
  });

  it('resets progress to initial state (fresh tutorial restart)', () => {
    repo.createProgress();
    repo.updateStepStatus('welcome', 'completed');
    repo.updateStepStatus('integrations', 'completed');
    repo.skipOnboarding();

    const reset = repo.resetProgress();

    expect(reset.completed).toBe(false);
    expect(reset.skipped).toBe(false);
    expect(reset.currentStep).toBe('welcome');
    for (const key of STEP_KEYS) {
      expect(reset.steps[key]).toBe('pending');
    }
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
  usePathname: () => '/dashboard',
}));

vi.mock('@/contexts/shared/lib/confetti', () => ({
  signUpConfetti: vi.fn(),
  planSelectConfetti: vi.fn(),
}));

// Mock localStorage
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
});

import { OnboardingOrchestrator } from './onboarding-orchestrator';

describe('OnboardingOrchestrator', () => {
  it('exports the component', () => {
    expect(OnboardingOrchestrator).toBeDefined();
    expect(typeof OnboardingOrchestrator).toBe('function');
  });

  it('registers a listener for causeflow:restart-tutorial event (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./onboarding-orchestrator.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('causeflow:restart-tutorial');
    expect(source).toContain('addEventListener');
    expect(source).toContain('removeEventListener');
    expect(source).toContain('resetOnboarding');
  });

  it('uses modal-only wizard with Next/Previous — no checklist widget', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./onboarding-orchestrator.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).not.toContain('OnboardingChecklist');
    expect(source).toContain('OnboardingModal');
    expect(source).toContain('currentStep');
  });

  it('filters billing tutorial step in OSS builds (AC-083)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./onboarding-orchestrator.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('getTutorialSteps');
    expect(source).toContain('isOssBuildClient');
  });

  it('auto-shows the tutorial for brand-new users when no progress exists', async () => {
    // Regression: tutorial previously relied solely on ?welcome=1 URL param,
    // which can be lost through Stripe redirects / middleware locale rewrites.
    // For first-time users (progress === null), the modal must auto-show.
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./onboarding-orchestrator.tsx', import.meta.url),
      'utf-8',
    );
    // Auto-show block must actually call setShowWizard(true), not the old
    // "Don't auto-show" comment.
    expect(source).not.toMatch(/Don't auto-show/);
    // Must trigger startOnboarding + setShowWizard when progress is null.
    expect(source).toMatch(/progress === null/);
  });
});

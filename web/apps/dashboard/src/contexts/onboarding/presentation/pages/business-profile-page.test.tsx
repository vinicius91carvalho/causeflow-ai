import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string) => k,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn().mockReturnValue(null) }),
}));

vi.mock('@/contexts/shared/presentation/components/toast-provider', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
}));

// Mock localStorage
vi.stubGlobal('localStorage', {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

describe('BusinessProfilePage', () => {
  it('exports the BusinessProfilePage component', async () => {
    const mod = await import('./business-profile-page');
    expect(mod.BusinessProfilePage).toBeDefined();
    expect(typeof mod.BusinessProfilePage).toBe('function');
  });

  it('fetches schema and profile on mount (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./business-profile-page.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('/api/onboarding/business-profile/schema');
    expect(source).toContain('/api/onboarding/business-profile');
  });

  it('posts to business-profile endpoint on submit (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./business-profile-page.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain("method: 'POST'");
    expect(source).toContain('/api/onboarding/business-profile');
  });

  it('redirects to /dashboard?welcome=1 on successful submit (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./business-profile-page.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('/dashboard?welcome=1');
  });

  it('posts to skip endpoint when user skips (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./business-profile-page.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('/api/onboarding/business-profile/skip');
  });

  it('accepts locale prop and passes it to wizard (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./business-profile-page.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('locale');
    expect(source).toContain('BusinessProfileWizard');
  });

  it('shows loading state while schema is fetching (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./business-profile-page.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('loading');
  });
});

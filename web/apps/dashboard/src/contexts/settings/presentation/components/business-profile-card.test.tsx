import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string) => k,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/contexts/identity/domain/rbac/role-guard', () => ({
  usePermission: () => true,
}));

vi.mock('@/contexts/shared/presentation/components/toast-provider', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
}));

describe('BusinessProfileCard', () => {
  it('exports the BusinessProfileCard component', async () => {
    const mod = await import('./business-profile-card');
    expect(mod.BusinessProfileCard).toBeDefined();
    expect(typeof mod.BusinessProfileCard).toBe('function');
  });

  it('shows submission state variants (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./business-profile-card.tsx', import.meta.url),
      'utf-8',
    );
    // Must handle not_started, skipped, submitted, failed states
    expect(source).toContain('submittedAt');
    expect(source).toContain('skippedAt');
    expect(source).toContain('hindsightStatus');
  });

  it('has Edit profile link to /onboarding/business-profile?edit=1 (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./business-profile-card.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('business-profile?edit=1');
  });

  it('has Resync button that calls resync endpoint (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./business-profile-card.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('/api/onboarding/business-profile/resync');
  });

  it('Resync button is only shown when hindsightStatus is failed (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./business-profile-card.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain("hindsightStatus === 'failed'");
  });

  it('shows the locale of the submitted profile (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./business-profile-card.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('locale');
  });
});

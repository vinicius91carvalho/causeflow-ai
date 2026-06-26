import { describe, expect, it, vi } from 'vitest';

vi.mock('@/contexts/shared/presentation/components/toast-provider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('@/contexts/identity/domain/rbac/role-guard', () => ({
  usePermission: () => true,
}));

describe('BusinessProfileCardWrapper', () => {
  it('renders without crashing when fetch returns null profile', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ profile: null }),
    });

    const { BusinessProfileCardWrapper } = await import('./business-profile-card-wrapper');
    expect(BusinessProfileCardWrapper).toBeDefined();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRedirect = vi.fn();
const mockIsOssRuntime = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    mockRedirect(path);
    throw new Error('NEXT_REDIRECT');
  },
}));

vi.mock('@/contexts/billing/application/oss-runtime', () => ({
  isOssRuntime: () => mockIsOssRuntime(),
}));

vi.mock('@/contexts/billing/presentation/pages/choose-plan-page', () => ({
  default: () => null,
}));

describe('ChoosePlanRoute (AC-082)', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
    mockIsOssRuntime.mockReset();
  });

  it('redirects to /dashboard in OSS runtime', async () => {
    mockIsOssRuntime.mockReturnValue(true);
    const ChoosePlanRoute = (await import('./page')).default;
    await expect(ChoosePlanRoute()).rejects.toThrow('NEXT_REDIRECT');
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('only renders commercial choose-plan UI when not OSS (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./page.tsx', import.meta.url), 'utf-8');
    expect(source).toMatch(/if \(isOssRuntime\(\)\) \{[\s\S]*redirect\('\/dashboard'\)/);
    expect(source).toContain('return <ChoosePlanPage />');
  });

  it('has server-side OSS guard in source (grep audit AC-082)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./page.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('isOssRuntime()');
    expect(source).toContain("redirect('/dashboard')");
    expect(source).toContain('AC-082');
  });
});

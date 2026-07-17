import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotFound = vi.fn();
const mockIsOssRuntime = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => {
    mockNotFound();
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/contexts/billing/application/oss-runtime', () => ({
  isOssRuntime: () => mockIsOssRuntime(),
}));

vi.mock('@/contexts/billing/presentation/pages/choose-plan-page', () => ({
  default: () => null,
}));

describe('ChoosePlanRoute (root AC-007)', () => {
  beforeEach(() => {
    mockNotFound.mockClear();
    mockIsOssRuntime.mockReset();
  });

  it('returns framework not-found in OSS runtime', async () => {
    mockIsOssRuntime.mockReturnValue(true);
    const ChoosePlanRoute = (await import('./page')).default;
    await expect(ChoosePlanRoute()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalled();
  });

  it('only renders commercial choose-plan UI when not OSS (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./page.tsx', import.meta.url), 'utf-8');
    expect(source).toMatch(/if \(isOssRuntime\(\)\) \{[\s\S]*notFound\(\)/);
    expect(source).toContain('return <ChoosePlanPage />');
  });

  it('has server-side OSS hard-remove in source (grep audit AC-007)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./page.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('isOssRuntime()');
    expect(source).toContain('notFound()');
    expect(source).toContain('AC-007');
    expect(source).not.toContain("redirect('/dashboard')");
  });
});

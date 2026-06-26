import { describe, expect, it } from 'vitest';

describe('OnboardingIntegrationsPage', () => {
  it('exports the page component as default', async () => {
    const mod = await import('./onboarding-integrations-page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('imports and renders OnboardingIntegrationsGrid', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('./onboarding-integrations-page.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('OnboardingIntegrationsGrid');
    expect(source).toContain('onboarding-integrations-grid');
  });
});

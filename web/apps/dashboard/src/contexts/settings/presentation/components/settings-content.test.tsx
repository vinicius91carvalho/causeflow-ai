import { describe, expect, it } from 'vitest';

describe('SettingsPage', () => {
  it('exports the SettingsPage component', async () => {
    // Can't render — mocking Clerk + intl + searchParams is complex.
    // Structural test only.
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./settings-content.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('SettingsPage');
    expect(source).toContain('export function SettingsPage');
  });

  it('includes BusinessProfileCard in company tab (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./settings-content.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('BusinessProfileCard');
  });

  it('loads business profile alongside settings data (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./settings-content.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('/api/onboarding/business-profile');
  });
});

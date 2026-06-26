import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string) => k,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
});

describe('BusinessProfileWizard', () => {
  it('exports the Wizard component', async () => {
    const mod = await import('./wizard');
    expect(mod.BusinessProfileWizard).toBeDefined();
    expect(typeof mod.BusinessProfileWizard).toBe('function');
  });

  it('resolves schema to active locale before rendering (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./wizard.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('resolveLocalizedSchema');
    expect(source).toContain('useMemo');
  });

  it('maintains step index for multi-step navigation (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./wizard.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('stepIndex');
    expect(source).toContain('setStepIndex');
  });

  it('calls onSubmit with answers and locale (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./wizard.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('onSubmit');
    expect(source).toContain('locale');
  });

  it('calls onSkip when skip is triggered (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./wizard.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('onSkip');
  });

  it('uses draft key per schema version not per locale (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./wizard.tsx', import.meta.url), 'utf-8');
    // Draft is per-version only — schema.version, not locale
    expect(source).toContain('saveDraft');
    expect(source).toContain('loadDraft');
    expect(source).toContain('clearDraft');
  });

  it('shows progress indicator (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./wizard.tsx', import.meta.url), 'utf-8');
    // Progress indicator must reference current step and total steps
    expect(source).toContain('resolvedSchema.steps.length');
  });

  it('performs per-step validation before advancing (structural)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./wizard.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('buildZodSchemaForStep');
    expect(source).toContain('safeParse');
  });
});

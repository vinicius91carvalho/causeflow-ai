import { describe, expect, it } from 'vitest';
import en from './en.json';
import ptBr from './pt-br.json';

describe('Onboarding i18n', () => {
  it('English file has dashboard.onboarding namespace', () => {
    expect(en.dashboard.onboarding).toBeDefined();
  });

  it('Portuguese file has dashboard.onboarding namespace', () => {
    expect(ptBr.dashboard.onboarding).toBeDefined();
  });

  it('both locales have the same keys', () => {
    const enKeys = JSON.stringify(Object.keys(en.dashboard.onboarding).sort());
    const ptBrKeys = JSON.stringify(Object.keys(ptBr.dashboard.onboarding).sort());
    expect(enKeys).toBe(ptBrKeys);
  });

  it('all step keys exist in both locales', () => {
    const stepKeys = ['welcome', 'integrations', 'relay', 'firstIncident', 'billing', 'complete'];
    for (const key of stepKeys) {
      expect(
        en.dashboard.onboarding.steps[key as keyof typeof en.dashboard.onboarding.steps],
      ).toBeDefined();
      expect(
        ptBr.dashboard.onboarding.steps[key as keyof typeof ptBr.dashboard.onboarding.steps],
      ).toBeDefined();
    }
  });

  it('wizard navigation keys exist in both locales', () => {
    expect(en.dashboard.onboarding.wizard).toBeDefined();
    expect(en.dashboard.onboarding.wizard.next).toBeDefined();
    expect(en.dashboard.onboarding.wizard.previous).toBeDefined();
    expect(en.dashboard.onboarding.wizard.stepOf).toBeDefined();
    expect(ptBr.dashboard.onboarding.wizard).toBeDefined();
    expect(ptBr.dashboard.onboarding.wizard.next).toBeDefined();
    expect(ptBr.dashboard.onboarding.wizard.previous).toBeDefined();
    expect(ptBr.dashboard.onboarding.wizard.stepOf).toBeDefined();
  });
});

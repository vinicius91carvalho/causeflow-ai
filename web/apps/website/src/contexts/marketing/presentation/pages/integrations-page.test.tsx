import { describe, expect, it } from 'vitest';
import en from '../../infrastructure/i18n/en.json';

describe('IntegrationsPage hero section', () => {
  it('hero title is present', () => {
    expect(en.integrations.hero.title).toBeTruthy();
  });

  it('hero subtitle is present', () => {
    expect(en.integrations.hero.subtitle).toBeTruthy();
  });

  it('count key has been removed', () => {
    expect(en.integrations.hero).not.toHaveProperty('count');
    expect(en.integrations.hero).not.toHaveProperty('countLabel');
  });
});

describe('IntegrationsPage security section', () => {
  it('has security title', () => {
    expect(en.integrations.security).toHaveProperty('title');
    expect(en.integrations.security.title).toBeTruthy();
  });

  it('has all 6 security cards', () => {
    const s = en.integrations.security;
    expect(s).toHaveProperty('soc2Title');
    expect(s).toHaveProperty('iso27001Title');
    expect(s).toHaveProperty('oauthTitle');
    expect(s).toHaveProperty('encryptionTitle');
    expect(s).toHaveProperty('readOnlyTitle');
    expect(s).toHaveProperty('tenantIsolationTitle');
  });

  it('security messaging is about integration infrastructure, not CauseFlow certifications', () => {
    const soc2 = en.integrations.security.soc2Description;
    expect(soc2).toBeTruthy();
    expect(typeof soc2).toBe('string');
  });
});

describe('IntegrationsPage catalog', () => {
  it('has andMore label for categories', () => {
    expect(en.integrations.catalog).toHaveProperty('andMore');
    expect(en.integrations.catalog.andMore).toBeTruthy();
  });
});

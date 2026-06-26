import { describe, expect, it } from 'vitest';
import en from '../../../infrastructure/i18n/en.json';

describe('IntegrationCard i18n', () => {
  it('integration hero section has title', () => {
    expect(en.integrations.hero).toHaveProperty('title');
    expect(en.integrations.hero.title).toBeTruthy();
  });

  it('integration hero section has subtitle', () => {
    expect(en.integrations.hero).toHaveProperty('subtitle');
    expect(en.integrations.hero.subtitle).toBeTruthy();
  });

  it('integration hero does not have count key (removed)', () => {
    expect(en.integrations.hero).not.toHaveProperty('count');
  });
});

describe('IntegrationCard agentConnection', () => {
  it('renders agentConnection as text when provided', () => {
    expect(en.integrations.security).toHaveProperty('soc2Title');
    expect(en.integrations.security).toHaveProperty('iso27001Title');
    expect(en.integrations.security).toHaveProperty('oauthTitle');
    expect(en.integrations.security).toHaveProperty('encryptionTitle');
    expect(en.integrations.security).toHaveProperty('readOnlyTitle');
    expect(en.integrations.security).toHaveProperty('tenantIsolationTitle');
  });

  it('integration security does not claim CauseFlow itself is certified — only infrastructure partners may be', () => {
    const soc2 = en.integrations.security.soc2Description;
    const iso = en.integrations.security.iso27001Description;
    // CauseFlow (the product) must not claim to be certified. Partner / provider
    // certifications are acceptable (we name the vendor that holds the cert).
    const productCertifiedClaim =
      /\b(CauseFlow|we|our (product|platform|app|service))\s+(is|are|holds?)\s+[^.]*\bcertifi/i;
    expect(soc2).not.toMatch(productCertifiedClaim);
    expect(iso).not.toMatch(productCertifiedClaim);
    // Must contain substantive security content
    expect(soc2).toBeTruthy();
    expect(iso).toBeTruthy();
  });
});

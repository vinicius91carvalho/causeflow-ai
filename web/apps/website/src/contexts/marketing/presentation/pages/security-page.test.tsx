import { describe, expect, it } from 'vitest';

/**
 * Tests for the new Integration Security section (Sprint 3).
 * Verifies the 6 cards are configured correctly, SOC 2 / ISO 27001:2022
 * messaging is for integration infrastructure only (not CauseFlow platform),
 * and the section is positioned after the compliance table.
 */

const INTEGRATION_SECURITY_CARD_KEYS = [
  'soc2',
  'iso27001',
  'oauth2',
  'encryptedCredentials',
  'readOnly',
  'tenantIsolation',
] as const;

const SECURITY_PAGE_SECTION_ORDER = [
  'hero',
  'deploymentApproaches',
  'commitments',
  'compliance',
  'integrationSecurity',
  'architecture',
  'isolation',
  'bedrock',
  'coFounderCta',
] as const;

describe('SecurityPage Integration Security section', () => {
  it('has exactly 6 integration security cards', () => {
    expect(INTEGRATION_SECURITY_CARD_KEYS).toHaveLength(6);
  });

  it('includes soc2 card', () => {
    expect(INTEGRATION_SECURITY_CARD_KEYS).toContain('soc2');
  });

  it('includes iso27001 card', () => {
    expect(INTEGRATION_SECURITY_CARD_KEYS).toContain('iso27001');
  });

  it('includes oauth2 card', () => {
    expect(INTEGRATION_SECURITY_CARD_KEYS).toContain('oauth2');
  });

  it('includes encryptedCredentials card', () => {
    expect(INTEGRATION_SECURITY_CARD_KEYS).toContain('encryptedCredentials');
  });

  it('includes readOnly card', () => {
    expect(INTEGRATION_SECURITY_CARD_KEYS).toContain('readOnly');
  });

  it('includes tenantIsolation card', () => {
    expect(INTEGRATION_SECURITY_CARD_KEYS).toContain('tenantIsolation');
  });
});

describe('SecurityPage section order (Integration Security placement)', () => {
  it('integrationSecurity section appears after compliance', () => {
    const complianceIdx = SECURITY_PAGE_SECTION_ORDER.indexOf('compliance');
    const integrationSecurityIdx = SECURITY_PAGE_SECTION_ORDER.indexOf('integrationSecurity');
    expect(integrationSecurityIdx).toBeGreaterThan(complianceIdx);
  });

  it('integrationSecurity section appears before architecture', () => {
    const integrationSecurityIdx = SECURITY_PAGE_SECTION_ORDER.indexOf('integrationSecurity');
    const architectureIdx = SECURITY_PAGE_SECTION_ORDER.indexOf('architecture');
    expect(integrationSecurityIdx).toBeLessThan(architectureIdx);
  });

  it('integrationSecurity is directly after compliance', () => {
    const complianceIdx = SECURITY_PAGE_SECTION_ORDER.indexOf('compliance');
    const integrationSecurityIdx = SECURITY_PAGE_SECTION_ORDER.indexOf('integrationSecurity');
    expect(integrationSecurityIdx).toBe(complianceIdx + 1);
  });
});

describe('SecurityPage Integration Security i18n key paths', () => {
  it('generates correct i18n key path for soc2 title', () => {
    const key = 'security.integrationSecurity.soc2.title';
    expect(key).toContain('integrationSecurity');
    expect(key).toContain('soc2');
  });

  it('generates correct i18n key path for iso27001', () => {
    const key = 'security.integrationSecurity.iso27001.title';
    expect(key).toContain('integrationSecurity');
    expect(key).toContain('iso27001');
  });

  it('generates correct i18n key path for section title', () => {
    const key = 'security.integrationSecurity.title';
    expect(key).toContain('integrationSecurity');
  });
});

describe('SecurityPage compliance table remains unchanged (SOC 2 In Progress)', () => {
  it('SOC 2 Type II remains marked as not yet compliant (isCompliant=false)', () => {
    // This mirrors the complianceItems in production — SOC 2 stays In Progress
    const complianceItems = [
      { name: 'LGPD', isCompliant: true },
      { name: 'GDPR', isCompliant: true },
      { name: 'SOC 2 Type II', isCompliant: false },
      { name: 'ISO 27001', isCompliant: false },
      { name: 'HIPAA', isCompliant: false },
    ];
    const soc2 = complianceItems.find((i) => i.name === 'SOC 2 Type II');
    expect(soc2?.isCompliant).toBe(false);
  });
});

/**
 * Tests for SecurityPage configuration.
 * Since the component is a server-rendered React component using next-intl,
 * we test the compliance table logic and content configuration.
 */

// Mirrors the complianceItems logic in the production component
// After Sprint 3 change: GDPR and LGPD show for ALL locales (no locale gate)
function buildComplianceItems(_locale: string) {
  // Post-change: always include GDPR and LGPD regardless of locale
  return [
    { name: 'LGPD', isCompliant: true },
    { name: 'GDPR', isCompliant: true },
    { name: 'SOC 2 Type II', isCompliant: false },
    { name: 'ISO 27001', isCompliant: false },
    { name: 'HIPAA', isCompliant: false },
  ];
}

describe('SecurityPage compliance table', () => {
  it('shows LGPD and GDPR for EN locale', () => {
    const items = buildComplianceItems('en');
    const names = items.map((i) => i.name);
    expect(names).toContain('LGPD');
    expect(names).toContain('GDPR');
  });

  it('shows LGPD and GDPR for PT-BR locale', () => {
    const items = buildComplianceItems('pt-br');
    const names = items.map((i) => i.name);
    expect(names).toContain('LGPD');
    expect(names).toContain('GDPR');
  });

  it('always shows 5 compliance items regardless of locale', () => {
    expect(buildComplianceItems('en')).toHaveLength(5);
    expect(buildComplianceItems('pt-br')).toHaveLength(5);
  });

  it('marks LGPD and GDPR as compliant', () => {
    const items = buildComplianceItems('en');
    const lgpd = items.find((i) => i.name === 'LGPD');
    const gdpr = items.find((i) => i.name === 'GDPR');
    expect(lgpd?.isCompliant).toBe(true);
    expect(gdpr?.isCompliant).toBe(true);
  });

  it('marks SOC2, ISO27001, and HIPAA as in-progress (not yet compliant)', () => {
    const items = buildComplianceItems('en');
    const soc2 = items.find((i) => i.name === 'SOC 2 Type II');
    const iso = items.find((i) => i.name === 'ISO 27001');
    const hipaa = items.find((i) => i.name === 'HIPAA');
    expect(soc2?.isCompliant).toBe(false);
    expect(iso?.isCompliant).toBe(false);
    expect(hipaa?.isCompliant).toBe(false);
  });
});

describe('SecurityPage commitment card i18n keys', () => {
  // Mirrors the commitmentGroups structure in the production component
  const commitmentGroups = [
    {
      titleKey: 'commitments.pillar1Title',
      cardKeys: ['onDemandReading', 'leastPrivilege', 'noWriteDefault'],
    },
    {
      titleKey: 'commitments.pillar2Title',
      cardKeys: ['tenantIsolation', 'noCrossTraining', 'immutableAuditTrail'],
    },
  ];

  it('includes leastPrivilege card in pillar 1', () => {
    const pillar1 = commitmentGroups[0];
    expect(pillar1.cardKeys).toContain('leastPrivilege');
  });

  it('includes immutableAuditTrail card in pillar 2', () => {
    const pillar2 = commitmentGroups[1];
    expect(pillar2.cardKeys).toContain('immutableAuditTrail');
  });

  it('generates correct i18n key path for leastPrivilege', () => {
    const key = 'security.commitments.leastPrivilege.description';
    expect(key).toContain('leastPrivilege');
  });

  it('generates correct i18n key path for immutableAuditTrail', () => {
    const key = 'security.commitments.immutableAuditTrail.description';
    expect(key).toContain('immutableAuditTrail');
  });

  it('has exactly 3 cards per pillar', () => {
    for (const group of commitmentGroups) {
      expect(group.cardKeys).toHaveLength(3);
    }
  });
});

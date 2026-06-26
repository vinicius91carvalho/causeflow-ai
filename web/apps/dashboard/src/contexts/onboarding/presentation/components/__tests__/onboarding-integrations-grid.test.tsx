import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/image', () => ({
  default: () => null,
}));

vi.mock('@/contexts/integrations/presentation/components/connection-modal', () => ({
  ConnectionModal: () => null,
}));

describe('OnboardingIntegrationsGrid', () => {
  it('exports the component as default', async () => {
    const mod = await import('../onboarding-integrations-grid');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('defines exactly 14 curated integration IDs', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('../onboarding-integrations-grid.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('ONBOARDING_INTEGRATION_IDS');
    // Count the IDs in the array
    const idsMatch = source.match(/ONBOARDING_INTEGRATION_IDS\s*=\s*\[([\s\S]*?)\]/);
    expect(idsMatch).toBeTruthy();
    const ids = idsMatch?.[1].match(/'[^']+'/g);
    expect(ids).toHaveLength(14);
  });

  it('includes all required integration IDs in order', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('../onboarding-integrations-grid.tsx', import.meta.url),
      'utf-8',
    );
    const expectedOrder = [
      'aws-cloudwatch',
      'github',
      'notion',
      'shortcut',
      'slack',
      'sentry',
      'datadog',
      'trello',
      'jira',
      'pagerduty',
      'zendesk',
      'intercom',
      'linear',
      'gitlab',
    ];
    const idsMatch = source.match(/ONBOARDING_INTEGRATION_IDS\s*=\s*\[([\s\S]*?)\]/);
    expect(idsMatch).toBeTruthy();
    const ids = idsMatch?.[1].match(/'([^']+)'/g)?.map((s) => s.replace(/'/g, ''));
    expect(ids).toEqual(expectedOrder);
  });

  it('uses responsive grid classes (mobile-first: 2-col, 3-col tablet, 4-col desktop)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('../onboarding-integrations-grid.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('grid-cols-2');
    expect(source).toMatch(/sm:grid-cols-3|md:grid-cols-3/);
    expect(source).toMatch(/lg:grid-cols-4|xl:grid-cols-4/);
  });

  it('renders ConnectionModal for credential-based integrations', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('../onboarding-integrations-grid.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('ConnectionModal');
    expect(source).toContain('connection-modal');
  });

  it('handles OAuth flow for OAuth-based integrations', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('../onboarding-integrations-grid.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('/api/integrations/oauth/');
    expect(source).toContain('window.open');
  });

  it('navigates to /onboarding/business-profile on Continue and Skip', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('../onboarding-integrations-grid.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('/onboarding/business-profile');
    expect(source).toContain('integrations.skip');
    expect(source).toContain('integrations.continue');
  });

  it('links to /onboarding/business-profile for "More integrations"', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('../onboarding-integrations-grid.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('/onboarding/business-profile');
    expect(source).toContain('integrations.moreIntegrations');
  });

  it('fetches integration statuses on mount', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('../onboarding-integrations-grid.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('/api/integrations');
    expect(source).toContain('useEffect');
  });

  it('fetches the integration catalog on mount to obtain awsSetup info', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('../onboarding-integrations-grid.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('/api/integrations/catalog');
    expect(source).toContain('fetchCatalog');
    expect(source).toContain('awsSetup');
  });

  it('passes awsSetup to ConnectionModal only for aws-cloudwatch', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('../onboarding-integrations-grid.tsx', import.meta.url),
      'utf-8',
    );
    // awsSetup is conditionally passed only when the modal is for aws-cloudwatch
    expect(source).toContain("connectModal.id === 'aws-cloudwatch' ? awsSetup : undefined");
  });

  it('passes type="aws" (not "cloudwatch") to ConnectionModal for aws-cloudwatch (persistence fix)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('../onboarding-integrations-grid.tsx', import.meta.url),
      'utf-8',
    );
    // Must use 'aws' so the Core API stores provider='aws', matching the readback predicate
    // i.type === 'aws' || i.provider === 'aws' → 'aws-cloudwatch' (lines 119-120)
    expect(source).toContain("connectModal.id === 'aws-cloudwatch'");
    expect(source).toContain("? 'aws'");
    // Must NOT use 'cloudwatch' as the type for AWS (that breaks readback persistence)
    expect(source).not.toMatch(/=== 'aws-cloudwatch'\s*\n\s*\? 'cloudwatch'/);
  });

  it('tracks connected count for progress indicator', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('../onboarding-integrations-grid.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('integrations.progress');
    expect(source).toMatch(/connectedCount|connected.*length/i);
  });

  it('shows connected status with check indicator', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('../onboarding-integrations-grid.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain('integrations.connected');
    expect(source).toContain('Check');
  });

  it('imports INTEGRATIONS from shared constants', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(
      new URL('../onboarding-integrations-grid.tsx', import.meta.url),
      'utf-8',
    );
    expect(source).toContain("from '@causeflow/shared/constants'");
    expect(source).toContain('INTEGRATIONS');
  });
});

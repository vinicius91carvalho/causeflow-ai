import { describe, expect, it } from 'vitest';

describe('WelcomePage', () => {
  it('exports the component as default', async () => {
    const mod = await import('./welcome-page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('links to /onboarding/integrations (not /onboarding/connect-aws)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./welcome-page.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('/onboarding/integrations');
    expect(source).not.toContain('/onboarding/connect-aws');
  });

  it('shows Set Up Integrations step (not Connect AWS)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./welcome-page.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('Set Up Integrations');
    expect(source).not.toContain("title: 'Connect AWS'");
  });

  it('shows Complete Business Profile step linking to /onboarding/business-profile', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./welcome-page.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('Complete Business Profile');
    expect(source).toContain('/onboarding/business-profile');
  });

  it('omits choose-plan step in OSS builds (AC-083)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./welcome-page.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('isOssBuildClient');
    expect(source).toContain("!step.href.includes('/onboarding/choose-plan')");
    expect(source).toContain('Choose Your Plan');
  });

  it('has a Get Started CTA button (no skip-to-dashboard link)', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./welcome-page.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('Get Started');
    expect(source).not.toContain('Skip to dashboard');
    expect(source).not.toContain('href="/dashboard"');
  });

  it('does not import Cloud or Zap icon', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./welcome-page.tsx', import.meta.url), 'utf-8');
    expect(source).not.toMatch(/\bCloud\b.*from.*lucide/);
    expect(source).not.toMatch(/\bZap\b.*from.*lucide/);
  });
});

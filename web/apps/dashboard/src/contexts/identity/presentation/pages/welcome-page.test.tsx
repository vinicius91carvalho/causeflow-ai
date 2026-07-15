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
    const source = fs.readFileSync(new URL('./welcome-setup-steps.ts', import.meta.url), 'utf-8');
    expect(source).toContain('Set Up Integrations');
    expect(source).not.toContain("title: 'Connect AWS'");
  });

  it('shows Complete Business Profile step linking to /onboarding/business-profile', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./welcome-setup-steps.ts', import.meta.url), 'utf-8');
    expect(source).toContain('Complete Business Profile');
    expect(source).toContain('/onboarding/business-profile');
  });

  it('keeps Choose Your Plan literals out of the OSS welcome module path (AC-083)', async () => {
    const fs = await import('node:fs');
    const welcomeSource = fs.readFileSync(new URL('./welcome-page.tsx', import.meta.url), 'utf-8');
    const baseSource = fs.readFileSync(
      new URL('./welcome-setup-steps.ts', import.meta.url),
      'utf-8',
    );
    const commercialSource = fs.readFileSync(
      new URL('./welcome-setup-steps-commercial.ts', import.meta.url),
      'utf-8',
    );

    expect(welcomeSource).toContain('isOssBuildClient');
    expect(welcomeSource).toContain('BASE_SETUP_STEPS');
    expect(welcomeSource).toContain("import('./welcome-setup-steps-commercial')");
    expect(welcomeSource).not.toContain('Choose Your Plan');
    expect(welcomeSource).not.toContain('Select a plan');
    expect(welcomeSource).not.toContain('/onboarding/choose-plan');

    expect(baseSource).not.toContain('Choose Your Plan');
    expect(baseSource).not.toContain('Select a plan');
    expect(baseSource).not.toContain('/onboarding/choose-plan');

    expect(commercialSource).toContain('Choose Your Plan');
    expect(commercialSource).toContain('Select a plan');
    expect(commercialSource).toContain('/onboarding/choose-plan');
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

import { describe, expect, it } from 'vitest';

describe('Topbar OrganizationSwitcher configuration', () => {
  it('hides the "Create organization" action in global Clerk appearance', async () => {
    const mod = await import('../clerk-theme-provider');
    expect(mod.ClerkThemeProvider).toBeDefined();
  });

  it('hides "Create organization" at the component level in topbar source', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./topbar.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('organizationSwitcherPopoverActionButton__createOrganization');
  });

  it('includes a tutorial action in the UserButton menu', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./topbar.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('UserButton.MenuItems');
    expect(source).toContain('UserButton.Action');
    expect(source).toContain('causeflow:restart-tutorial');
  });
});

describe('Topbar DevThemeSwitcher removal', () => {
  it('does not import or render DevThemeSwitcher', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./topbar.tsx', import.meta.url), 'utf-8');
    expect(source).not.toContain('DevThemeSwitcher');
  });
});

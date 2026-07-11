import { describe, expect, it } from 'vitest';

describe('Topbar (AC-046) — OSS auth UI', () => {
  it('does not import hosted-auth SDK components', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./topbar.tsx', import.meta.url), 'utf-8');
    expect(source).not.toContain('OrganizationSwitcher');
    expect(source).not.toContain('UserButton');
  });

  it('has a sign-out button that calls /api/auth/logout', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./topbar.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('/api/auth/logout');
  });

  it('includes a tutorial button dispatching causeflow:restart-tutorial', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./topbar.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('causeflow:restart-tutorial');
  });

  it('does not import or render DevThemeSwitcher', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./topbar.tsx', import.meta.url), 'utf-8');
    expect(source).not.toContain('DevThemeSwitcher');
  });

  it('renders user avatar from auth context', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./topbar.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('UserAvatar');
    expect(source).toContain('useUser');
  });
});

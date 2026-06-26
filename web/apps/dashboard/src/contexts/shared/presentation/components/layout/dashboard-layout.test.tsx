import { describe, expect, it } from 'vitest';

describe('DashboardLayout', () => {
  it('exports DashboardLayout as a named export', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./dashboard-layout.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('export function DashboardLayout');
  });

  it('applies gradient background class to the content column', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./dashboard-layout.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('bg-gradient-to-br');
    expect(source).toContain('from-background');
    expect(source).toContain('via-background');
    expect(source).toContain('to-primary/5');
  });

  it('includes the grid overlay div with correct style and aria-hidden', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./dashboard-layout.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain("backgroundSize: '64px 64px'");
    expect(source).toContain('pointer-events-none absolute inset-0');
  });

  it('uses absolute inset-0 (not fixed) so the grid stays within the content area', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./dashboard-layout.tsx', import.meta.url), 'utf-8');
    // Grid overlay must be absolute, not fixed
    expect(source).toContain('absolute inset-0');
    expect(source).not.toContain('fixed inset-0');
  });

  it('main element has relative positioning to contain the grid overlay', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./dashboard-layout.tsx', import.meta.url), 'utf-8');
    // The main element must include the `relative` class
    expect(source).toContain('relative flex-1 overflow-y-auto');
  });
});

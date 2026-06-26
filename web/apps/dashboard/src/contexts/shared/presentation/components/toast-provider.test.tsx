import { describe, expect, it } from 'vitest';

describe('ToastProvider', () => {
  it('gates createPortal on a mounted flag to prevent SSR hydration mismatch', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./toast-provider.tsx', import.meta.url), 'utf-8');

    // Must NOT gate on `typeof document` — that diverges between server render
    // (document undefined → no portal) and first client render (document defined
    // → portal), causing a hydration mismatch at the slot.
    expect(source).not.toContain("typeof document !== 'undefined'");

    // Must use a mounted-flag + effect pattern: the effect only runs on the client
    // after hydration, so the server render and the first client render agree
    // (both skip the portal), and the portal appears on the second client render.
    expect(source).toMatch(/setMounted\(true\)/);
    expect(source).toMatch(/mounted\s*&&\s*createPortal/);
  });

  it('exports ToastProvider and useToast', async () => {
    const mod = await import('./toast-provider');
    expect(mod.ToastProvider).toBeDefined();
    expect(mod.useToast).toBeDefined();
  });
});

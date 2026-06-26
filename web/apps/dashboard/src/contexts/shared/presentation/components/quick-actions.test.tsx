import { describe, expect, it } from 'vitest';

describe('QuickActions', () => {
  it('exports QuickActions as a named export', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./quick-actions.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('export function QuickActions');
  });
});

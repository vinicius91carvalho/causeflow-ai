import { describe, expect, it } from 'vitest';

describe('Sidebar', () => {
  it('exports Sidebar as a named export', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./sidebar.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('export function Sidebar');
  });
});

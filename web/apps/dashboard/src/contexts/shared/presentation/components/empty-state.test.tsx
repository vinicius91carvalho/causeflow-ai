import { describe, expect, it } from 'vitest';

describe('EmptyState', () => {
  it('uses warning color for the CTA button', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./empty-state.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('bg-warning');
    expect(source).toContain('text-warning');
  });
});

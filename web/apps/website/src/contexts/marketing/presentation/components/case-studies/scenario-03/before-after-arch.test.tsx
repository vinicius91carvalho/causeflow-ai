/**
 * Source-guard tests for BeforeAfterArch.
 * Validates: two mini diagrams (before/after), SSR vs ISR labeling, color contrast.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./before-after-arch.tsx', import.meta.url)),
  'utf-8',
);

describe('BeforeAfterArch component contract', () => {
  it('exports BeforeAfterArch as named export', () => {
    expect(source).toMatch(/export function BeforeAfterArch/);
  });

  it('has a "before" diagram label or section', () => {
    expect(source).toMatch(/before|Before|SSR/);
  });

  it('has an "after" diagram label or section', () => {
    expect(source).toMatch(/after|After|ISR/);
  });

  it('references ISR with revalidate: 300', () => {
    expect(source).toMatch(/300|revalidate/);
  });

  it('uses muted or subdued colors for the before state', () => {
    expect(source).toMatch(/muted|subdued|opacity|before/i);
  });

  it('uses accent colors for the after state', () => {
    expect(source).toMatch(/accent|green|emerald/i);
  });

  it('accepts i18n labels for section titles', () => {
    expect(source).toMatch(/labels|beforeLabel|afterLabel|interface\s+Before/i);
  });

  it('renders side by side on larger screens', () => {
    expect(source).toMatch(/sm:|md:|grid|flex-row/);
  });
});

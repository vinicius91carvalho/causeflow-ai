/**
 * Source-level guard: DS colors applied per status/severity, no text-*-foreground on pale tints.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./status-badge.tsx', import.meta.url)), 'utf-8');

describe('status-badge DS colors', () => {
  it('does not use text-accent-foreground (was rendering white in light mode)', () => {
    expect(source).not.toMatch(/text-accent-foreground/);
  });

  it('uses brand-purple for medium severity and triaging status', () => {
    expect(source).toMatch(/brand-purple/);
  });

  it('uses success for resolved and low', () => {
    expect(source).toMatch(/text-success/);
  });

  it('uses warning for awaiting_approval and open', () => {
    expect(source).toMatch(/text-warning/);
  });
});

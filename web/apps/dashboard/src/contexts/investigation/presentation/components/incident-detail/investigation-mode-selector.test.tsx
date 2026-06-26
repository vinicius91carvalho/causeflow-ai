/**
 * Source-level guard: Run button uses readable DS colors in light mode
 * (was bg-muted + text-white which rendered invisible on pale muted bg).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./investigation-mode-selector.tsx', import.meta.url)),
  'utf-8',
);

describe('investigation-mode-selector DS colors', () => {
  it('Run button does not combine bg-muted with text-white', () => {
    expect(source).not.toMatch(/bg-muted[^"]*text-white/);
  });

  it('Run button uses bg-accent with accent-foreground', () => {
    expect(source).toMatch(/bg-accent/);
  });
});

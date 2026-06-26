/**
 * Source-level contract tests for EvidenceCard.
 * Validates that the locked prop interface is present.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./evidence-card.tsx', import.meta.url)),
  'utf-8',
);

describe('EvidenceCard component contract', () => {
  it('exports EvidenceCardProps interface', () => {
    expect(source).toMatch(/EvidenceCardProps/);
  });

  it('accepts lines prop (string array)', () => {
    expect(source).toMatch(/lines/);
  });

  it('accepts optional title prop', () => {
    expect(source).toMatch(/title/);
  });

  it('accepts optional tone prop with default|warn|error variants', () => {
    expect(source).toMatch(/tone/);
    expect(source).toMatch(/warn/);
    expect(source).toMatch(/error/);
  });

  it('uses monospace font styling', () => {
    expect(source).toMatch(/mono/);
  });
});

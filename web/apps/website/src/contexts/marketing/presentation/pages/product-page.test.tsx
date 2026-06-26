import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Static source-analysis tests for product-page.tsx.
 * Verifies WCAG 2.1 AA contrast fix: small sub-labels (text-xs eyebrow/meta)
 * must use text-foreground/80 instead of text-muted-foreground so that
 * contrast meets the 4.5:1 threshold at small font sizes.
 */

const source = readFileSync(new URL('./product-page.tsx', import.meta.url).pathname, 'utf8');

describe('ProductPage — WCAG contrast: small sub-label utilities', () => {
  it('uses text-foreground/80 for phase2 firstOccurrence label (text-xs eyebrow)', () => {
    expect(source).toMatch(/text-xs font-semibold uppercase tracking-wide text-foreground\/80/);
  });

  it('uses text-foreground/80 for phase2 kbEntry label (text-xs eyebrow)', () => {
    // The kbEntry label "Knowledge Base Entry" is a second text-xs eyebrow
    const matches = [
      ...source.matchAll(/text-xs font-semibold uppercase tracking-wide text-foreground\/80/g),
    ];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('does not use text-muted-foreground on text-xs uppercase eyebrow labels', () => {
    // No text-xs + uppercase + text-muted-foreground combination should remain
    expect(source).not.toMatch(
      /text-xs font-semibold uppercase tracking-wide text-muted-foreground(?!\s*mb)/,
    );
  });

  it('uses text-foreground/70 or lower for the runbook dimmed note', () => {
    // The deliberately de-emphasized runbook note keeps a dimmed style (not full foreground)
    expect(source).toMatch(/text-xs text-muted-foreground\/70/);
  });
});

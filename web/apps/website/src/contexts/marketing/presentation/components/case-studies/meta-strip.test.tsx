/**
 * Source-level contract tests for MetaStrip.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./meta-strip.tsx', import.meta.url)), 'utf-8');

describe('MetaStrip component contract', () => {
  it('exports MetaStripProps interface', () => {
    expect(source).toMatch(/MetaStripProps/);
  });

  it('accepts readTime, severity, impact props', () => {
    expect(source).toMatch(/readTime/);
    expect(source).toMatch(/severity/);
    expect(source).toMatch(/impact/);
  });

  it('accepts optional resolvedIn chip (CauseFlow fix time)', () => {
    expect(source).toMatch(/resolvedIn\?:/);
  });

  it('severity.tone accepts high | medium | low', () => {
    expect(source).toMatch(/high/);
    expect(source).toMatch(/medium/);
    expect(source).toMatch(/low/);
  });

  it('maps high severity to red styling', () => {
    expect(source).toMatch(/red/);
  });

  it('maps medium severity to amber styling', () => {
    expect(source).toMatch(/amber/);
  });

  it('resolved chip uses accent color to stand out', () => {
    expect(source).toMatch(/bg-accent|text-accent|border-accent/);
  });
});

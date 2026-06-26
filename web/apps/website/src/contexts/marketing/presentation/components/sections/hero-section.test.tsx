/**
 * Source-level contract tests for HeroSection.
 *
 * Dark variant must use gradient background (not flat bg-slate-950).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./hero-section.tsx', import.meta.url)), 'utf-8');

describe('HeroSection source contract', () => {
  it('dark variant uses gradient (not flat slate-950)', () => {
    expect(source).not.toMatch(/bg-slate-950/);
    expect(source).toMatch(/radial-gradient|linear-gradient/);
  });

  it('declares dark and light variants', () => {
    expect(source).toMatch(/variant\?: 'dark' \| 'light'/);
  });
});

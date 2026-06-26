/**
 * Source-level contract tests for CaseStudyBreadcrumb.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./case-study-breadcrumb.tsx', import.meta.url)),
  'utf-8',
);

describe('CaseStudyBreadcrumb component contract', () => {
  it('exports CaseStudyBreadcrumbProps interface', () => {
    expect(source).toMatch(/CaseStudyBreadcrumbProps/);
  });

  it('accepts rootLabel and currentLabel props', () => {
    expect(source).toMatch(/rootLabel/);
    expect(source).toMatch(/currentLabel/);
  });

  it('links rootLabel to /use-cases', () => {
    expect(source).toMatch(/use-cases/);
  });

  it('renders a separator between root and current', () => {
    expect(source).toMatch(/›|chevron|separator/i);
  });
});

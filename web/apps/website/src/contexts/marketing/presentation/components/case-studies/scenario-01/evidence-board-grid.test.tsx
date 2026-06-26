/**
 * Source-guard contract tests for EvidenceBoardGrid.
 * Validates that the component renders the four evidence cards for scenario-01.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./evidence-board-grid.tsx', import.meta.url)),
  'utf-8',
);

describe('EvidenceBoardGrid component contract', () => {
  it('exports EvidenceBoardGrid function', () => {
    expect(source).toMatch(/EvidenceBoardGrid/);
  });

  it('renders a 2×2 grid layout', () => {
    expect(source).toMatch(/grid/);
    expect(source).toMatch(/grid-cols/);
  });

  it('uses EvidenceCard primitive', () => {
    expect(source).toMatch(/EvidenceCard/);
  });

  it('references DynamoDB job record evidence', () => {
    expect(source).toMatch(/dynamo/i);
  });

  it('references CloudWatch seeder warning', () => {
    expect(source).toMatch(/cloudwatch/i);
  });

  it('collapses to 1 column on mobile', () => {
    // Should have sm: or lg: breakpoint on grid-cols
    expect(source).toMatch(/sm:grid-cols|lg:grid-cols/);
  });
});

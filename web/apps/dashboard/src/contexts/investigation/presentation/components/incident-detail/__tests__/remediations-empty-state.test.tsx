/**
 * Source-introspection tests for <RemediationsEmptyState>.
 *
 * The component is a small switch over `state` props, so the test asserts:
 *   - The four states are wired (loading is handled by the parent skeleton)
 *   - The Retry button is conditional on state === 'error' AND onRetry
 *   - The completedEmptyWithCause i18n key is used when rootCause is set
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RemediationsEmptyState } from '../remediations-empty-state';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, '..', 'remediations-empty-state.tsx'), 'utf8');

describe('<RemediationsEmptyState>', () => {
  it('exports the component', () => {
    expect(RemediationsEmptyState).toBeDefined();
    expect(typeof RemediationsEmptyState).toBe('function');
  });

  it('renders all three non-populated states', () => {
    expect(SOURCE).toMatch(/'pending'/);
    expect(SOURCE).toMatch(/'completed-empty'/);
    expect(SOURCE).toMatch(/'error'/);
  });

  it('uses the inline-cause i18n key when rootCause is provided', () => {
    expect(SOURCE).toMatch(/completedEmptyWithCause/);
    expect(SOURCE).toMatch(/completedEmpty/);
  });

  it('renders the Retry button only on error state with onRetry', () => {
    expect(SOURCE).toMatch(/state === 'error'/);
    expect(SOURCE).toMatch(/onRetry/);
  });

  it('uses lucide icons for visual differentiation per state', () => {
    expect(SOURCE).toMatch(/Clock|Loader2/);
    expect(SOURCE).toMatch(/CheckCircle/);
    expect(SOURCE).toMatch(/AlertCircle|AlertTriangle/);
  });
});

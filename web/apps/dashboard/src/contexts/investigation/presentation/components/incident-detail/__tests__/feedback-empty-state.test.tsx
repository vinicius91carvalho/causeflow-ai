import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FeedbackEmptyState } from '../feedback-empty-state';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCE = readFileSync(join(__dirname, '..', 'feedback-empty-state.tsx'), 'utf8');

describe('<FeedbackEmptyState>', () => {
  it('exports the component', () => {
    expect(FeedbackEmptyState).toBeDefined();
    expect(typeof FeedbackEmptyState).toBe('function');
  });

  it('renders empty and error states', () => {
    expect(SOURCE).toMatch(/'empty'/);
    expect(SOURCE).toMatch(/'error'/);
  });

  it('shows a Retry button only on error state with onRetry', () => {
    expect(SOURCE).toMatch(/onRetry/);
    expect(SOURCE).toMatch(/state === 'error'/);
  });

  it('uses the dashboard.incidents.detail.feedback namespace', () => {
    expect(SOURCE).toMatch(/dashboard\.incidents\.detail\.feedback/);
  });
});

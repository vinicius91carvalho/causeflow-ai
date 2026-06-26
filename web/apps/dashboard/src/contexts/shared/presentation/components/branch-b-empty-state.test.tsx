import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, './branch-b-empty-state.tsx'), 'utf-8');

describe('BranchBEmptyState', () => {
  it('exports BranchBEmptyState as a named export', () => {
    expect(source).toContain('export function BranchBEmptyState');
  });

  it('renders a single CTA button — create first analysis', () => {
    expect(source).toContain('cta-create-first-analysis');
  });

  it('does NOT render a connect-integration or setup-relay button', () => {
    expect(source).not.toContain('cta-connect-integration');
    expect(source).not.toContain('cta-setup-relay');
  });

  it('links to /dashboard/analyses/new', () => {
    expect(source).toContain('/dashboard/analyses/new');
  });

  it('has the branch-b-empty-state data-testid', () => {
    expect(source).toContain('branch-b-empty-state');
  });

  it('accepts a messages prop for all text (no hardcoded copy)', () => {
    expect(source).toContain('messages');
    expect(source).not.toContain('"Welcome to CauseFlow"');
    expect(source).not.toContain("'Welcome to CauseFlow'");
  });
});

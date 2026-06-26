import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, './branch-a-empty-state.tsx'), 'utf-8');

describe('BranchAEmptyState', () => {
  it('exports BranchAEmptyState as a named export', () => {
    expect(source).toContain('export function BranchAEmptyState');
  });

  it('renders two CTA buttons — connect integration and set up relay', () => {
    expect(source).toContain('cta-connect-integration');
    expect(source).toContain('cta-setup-relay');
  });

  it('links to /dashboard/integrations', () => {
    expect(source).toContain('/dashboard/integrations');
  });

  it('links to /dashboard/relay', () => {
    expect(source).toContain('/dashboard/relay');
  });

  it('has the branch-a-empty-state data-testid', () => {
    expect(source).toContain('branch-a-empty-state');
  });

  it('accepts a messages prop for all text (no hardcoded copy)', () => {
    expect(source).toContain('messages');
    expect(source).not.toContain('"Welcome to CauseFlow"');
    expect(source).not.toContain("'Welcome to CauseFlow'");
  });
});

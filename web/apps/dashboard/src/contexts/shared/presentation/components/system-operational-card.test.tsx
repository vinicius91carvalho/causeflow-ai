import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, './system-operational-card.tsx'), 'utf-8');

describe('SystemOperationalCard — source', () => {
  it('has data-testid="system-operational-card"', () => {
    expect(source).toContain('system-operational-card');
  });

  it('links to /dashboard/analyses/new for New Analysis CTA', () => {
    expect(source).toContain('/dashboard/analyses/new');
  });

  it('displays integration count', () => {
    expect(source).toContain('integrationCount');
  });

  it('fetches health from /api/health', () => {
    expect(source).toContain('/api/health');
  });

  it('uses AbortController', () => {
    expect(source).toContain('AbortController');
  });

  it('renders ok/degraded/down status labels from messages prop', () => {
    expect(source).toContain('messages.ok');
    expect(source).toContain('messages.degraded');
    expect(source).toContain('messages.down');
  });

  it('renders error state from messages.error prop', () => {
    expect(source).toContain('messages.error');
  });
});

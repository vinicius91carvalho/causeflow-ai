import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, './dashboard-page.tsx'), 'utf-8');

describe('DashboardPage (dashboard-page.tsx)', () => {
  it('includes branchA i18n keys in the messages object', () => {
    expect(source).toContain('branchA');
    expect(source).toContain('connectIntegration');
    expect(source).toContain('setUpRelay');
  });

  it('includes branchB i18n keys in the messages object', () => {
    expect(source).toContain('branchB');
    expect(source).toContain('createFirstAnalysis');
  });

  it('passes messages to DashboardOverview', () => {
    expect(source).toContain('<DashboardOverview messages={messages}');
  });
});

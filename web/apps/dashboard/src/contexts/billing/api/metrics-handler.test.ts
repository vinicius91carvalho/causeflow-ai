import { describe, expect, it } from 'vitest';

describe('metrics-handler', () => {
  it('exports GET handler', async () => {
    const mod = await import('./metrics-handler');
    expect(mod.GET).toBeDefined();
  });

  it('fetches integrations count from listIntegrations and omits credits quota fields', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./metrics-handler.ts', import.meta.url), 'utf-8');
    expect(source).toContain('listIntegrations');
    expect(source).toContain('integrationList.length');
    expect(source).not.toContain('credits-ledger');
    expect(source).not.toContain('creditsTotal');
    expect(source).not.toContain('creditsRemaining');
    expect(source).not.toContain('creditsUsed');
    expect(source).not.toContain('FREE_PLAN_MONTHLY_CREDITS');
    expect(source).not.toContain('?? 5');
  });
});

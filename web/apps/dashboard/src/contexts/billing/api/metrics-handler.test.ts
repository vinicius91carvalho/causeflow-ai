import { describe, expect, it } from 'vitest';

describe('metrics-handler', () => {
  it('exports GET handler', async () => {
    const mod = await import('./metrics-handler');
    expect(mod.GET).toBeDefined();
  });

  it('fetches integrations count from listIntegrations instead of credits mock', async () => {
    // Structural test: verify the handler calls listIntegrations
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./metrics-handler.ts', import.meta.url), 'utf-8');
    expect(source).toContain('listIntegrations');
    expect(source).toContain('integrationList.length');
    // Verify no hardcoded creditsTotal default of 5
    expect(source).not.toContain('?? 5');
  });
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('useIncidentActions configure-LLM errors (AC-090)', () => {
  const source = readFileSync(new URL('./use-incident-actions.ts', import.meta.url), 'utf8');

  it('surfaces Core API error text for triage failures', () => {
    expect(source).toContain("err.error ?? t('actions.triageFailed')");
  });

  it('surfaces Core API error text for investigation failures', () => {
    expect(source).toContain("err.error ?? t('actions.investigationFailed')");
  });
});

describe('investigation BFF handlers configure-LLM errors (AC-090)', () => {
  it('triage-handler proxies CoreApiError messages', () => {
    const source = readFileSync(new URL('../../api/triage-handler.ts', import.meta.url), 'utf8');
    expect(source).toContain('CoreApiError');
    expect(source).toContain('{ error: msg }');
  });

  it('investigate-handler proxies CoreApiError messages', () => {
    const source = readFileSync(
      new URL('../../api/investigate-handler.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain('CoreApiError');
    expect(source).toContain('{ error: msg }');
  });
});

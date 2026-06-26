import { describe, it, expect } from 'vitest';
import { GrafanaParser } from '../../../../../src/modules/ingestion/infra/parsers/grafana.parser.js';

describe('GrafanaParser', () => {
  const parser = new GrafanaParser();

  it('should have source "grafana"', () => {
    expect(parser.source).toBe('grafana');
  });

  it('should detect Grafana payloads with canParse', () => {
    expect(parser.canParse({ title: 'Alert', state: 'alerting' })).toBe(true);
    expect(parser.canParse({ title: 'Alert' })).toBe(false);
    expect(parser.canParse({ state: 'alerting' })).toBe(false);
  });

  it('should parse alert with correct severity mapping', () => {
    const result = parser.parse({
      source: 'grafana',
      externalId: 'rule-1',
      payload: {
        title: 'High Memory',
        state: 'alerting',
        message: 'Memory usage above threshold',
        evalMatches: [{ metric: 'memory.usage', value: 95 }],
        tags: { environment: 'staging', service: 'web' },
      },
    });

    expect(result.title).toBe('High Memory');
    expect(result.severity).toBe('critical');
    expect(result.service).toBe('memory.usage');
    expect(result.environment).toBe('staging');
  });

  it('should map no_data to high severity', () => {
    const result = parser.parse({
      source: 'grafana',
      externalId: 'rule-2',
      payload: { title: 'No Data', state: 'no_data' },
    });

    expect(result.severity).toBe('high');
  });

  it('should map ok to low severity', () => {
    const result = parser.parse({
      source: 'grafana',
      externalId: 'rule-3',
      payload: { title: 'Recovered', state: 'ok' },
    });

    expect(result.severity).toBe('low');
  });
});

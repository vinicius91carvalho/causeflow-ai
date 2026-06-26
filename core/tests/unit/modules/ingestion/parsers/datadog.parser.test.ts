import { describe, it, expect } from 'vitest';
import { DatadogParser } from '../../../../../src/modules/ingestion/infra/parsers/datadog.parser.js';

describe('DatadogParser', () => {
  const parser = new DatadogParser();

  it('should have source "datadog"', () => {
    expect(parser.source).toBe('datadog');
  });

  it('should detect Datadog payloads with canParse', () => {
    expect(parser.canParse({ alert_type: 'error', title: 'CPU High' })).toBe(true);
    expect(parser.canParse({ title: 'CPU High' })).toBe(false);
    expect(parser.canParse({ alert_type: 'error' })).toBe(false);
    expect(parser.canParse({})).toBe(false);
  });

  it('should parse alert with correct severity mapping', () => {
    const result = parser.parse({
      source: 'datadog',
      externalId: 'alert-1',
      payload: {
        alert_type: 'error',
        title: 'CPU High',
        body: 'CPU usage at 95%',
        tags: ['env:production', 'service:api-gateway'],
        aggreg_key: 'api-service',
      },
    });

    expect(result.title).toBe('CPU High');
    expect(result.description).toBe('CPU usage at 95%');
    expect(result.severity).toBe('critical');
    expect(result.service).toBe('api-service');
    expect(result.environment).toBe('production');
    expect(result.tags['env']).toBe('production');
    expect(result.tags['service']).toBe('api-gateway');
  });

  it('should map warning to high severity', () => {
    const result = parser.parse({
      source: 'datadog',
      externalId: 'alert-2',
      payload: { alert_type: 'warning', title: 'Disk Warning' },
    });

    expect(result.severity).toBe('high');
  });

  it('should default to medium for unknown alert types', () => {
    const result = parser.parse({
      source: 'datadog',
      externalId: 'alert-3',
      payload: { alert_type: 'custom', title: 'Custom Alert' },
    });

    expect(result.severity).toBe('medium');
  });
});

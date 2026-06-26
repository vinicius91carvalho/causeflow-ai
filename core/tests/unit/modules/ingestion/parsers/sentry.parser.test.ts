import { describe, it, expect } from 'vitest';
import { SentryParser } from '../../../../../src/modules/ingestion/infra/parsers/sentry.parser.js';

describe('SentryParser', () => {
  const parser = new SentryParser();

  it('should have source "sentry"', () => {
    expect(parser.source).toBe('sentry');
  });

  it('should detect Sentry payloads with canParse', () => {
    expect(parser.canParse({ action: 'created', data: { issue: { id: 1 } } })).toBe(true);
    expect(parser.canParse({ action: 'created' })).toBe(false);
    expect(parser.canParse({ data: { issue: { id: 1 } } })).toBe(false);
    expect(parser.canParse({ action: 'created', data: {} })).toBe(false);
  });

  it('should parse issue with correct severity mapping', () => {
    const result = parser.parse({
      source: 'sentry',
      externalId: '12345',
      payload: {
        action: 'created',
        project_name: 'my-api',
        environment: 'production',
        data: {
          issue: {
            id: 12345,
            title: 'TypeError: Cannot read property',
            culprit: 'app.js in handleRequest',
            level: 'fatal',
          },
        },
      },
    });

    expect(result.title).toBe('TypeError: Cannot read property');
    expect(result.severity).toBe('critical');
    expect(result.service).toBe('my-api');
    expect(result.environment).toBe('production');
    expect(result.tags['project']).toBe('my-api');
  });

  it('should map error to high severity', () => {
    const result = parser.parse({
      source: 'sentry',
      externalId: '456',
      payload: {
        action: 'created',
        data: { issue: { id: 456, title: 'Error', level: 'error' } },
      },
    });

    expect(result.severity).toBe('high');
  });

  it('should use issue id as externalId when not provided', () => {
    const result = parser.parse({
      source: 'sentry',
      externalId: '',
      payload: {
        action: 'created',
        data: { issue: { id: 789, title: 'Error', level: 'warning' } },
      },
    });

    expect(result.externalId).toBe('789');
    expect(result.severity).toBe('medium');
  });
});

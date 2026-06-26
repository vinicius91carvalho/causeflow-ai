import { describe, it, expect } from 'vitest';
import { CloudWatchParser } from '../../../../../src/modules/ingestion/infra/parsers/cloudwatch.parser.js';

describe('CloudWatchParser', () => {
  const parser = new CloudWatchParser();

  it('should have source "cloudwatch"', () => {
    expect(parser.source).toBe('cloudwatch');
  });

  it('should detect CloudWatch payloads with canParse', () => {
    expect(parser.canParse({ AlarmName: 'CPU', NewStateValue: 'ALARM' })).toBe(true);
    expect(parser.canParse({ AlarmName: 'CPU' })).toBe(false);
    expect(parser.canParse({ NewStateValue: 'ALARM' })).toBe(false);
  });

  it('should parse alarm with correct severity mapping', () => {
    const result = parser.parse({
      source: 'cloudwatch',
      externalId: 'alarm-1',
      payload: {
        AlarmName: 'HighCPUUtilization',
        NewStateValue: 'ALARM',
        NewStateReason: 'Threshold crossed',
        Region: 'us-east-1',
        AlarmArn: 'arn:aws:cloudwatch:us-east-1:123456:alarm:HighCPU',
        Trigger: { Namespace: 'AWS/EC2' },
      },
    });

    expect(result.title).toBe('HighCPUUtilization');
    expect(result.severity).toBe('critical');
    expect(result.service).toBe('AWS/EC2');
    expect(result.environment).toBe('us-east-1');
    expect(result.tags['region']).toBe('us-east-1');
    expect(result.tags['alarmArn']).toContain('arn:aws');
  });

  it('should map INSUFFICIENT_DATA to medium', () => {
    const result = parser.parse({
      source: 'cloudwatch',
      externalId: 'alarm-2',
      payload: { AlarmName: 'Test', NewStateValue: 'INSUFFICIENT_DATA', Trigger: {} },
    });

    expect(result.severity).toBe('medium');
  });

  it('should map OK to low', () => {
    const result = parser.parse({
      source: 'cloudwatch',
      externalId: 'alarm-3',
      payload: { AlarmName: 'Recovered', NewStateValue: 'OK', Trigger: {} },
    });

    expect(result.severity).toBe('low');
  });
});

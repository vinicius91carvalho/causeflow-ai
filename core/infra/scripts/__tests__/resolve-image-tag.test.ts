import { describe, it, expect } from 'vitest';
import { resolveImageTag } from '../resolve-image-tag.js';
import { ConfigError } from '../lib/errors.js';

describe('resolveImageTag', () => {
  const baseInput = {
    sha: 'abcdef1234567890abcdef1234567890abcdef12',
    accountId: '409171461008',
    region: 'us-east-2',
  };

  it('produces correct API and worker image URIs for staging', () => {
    const tags = resolveImageTag({ ...baseInput, stage: 'staging' });
    expect(tags.shortSha).toBe('abcdef1');
    expect(tags.api).toBe(
      '409171461008.dkr.ecr.us-east-2.amazonaws.com/causeflow-staging:abcdef1'
    );
    expect(tags.worker).toBe(
      '409171461008.dkr.ecr.us-east-2.amazonaws.com/causeflow-staging:worker-abcdef1'
    );
  });

  it('produces correct image URIs for production', () => {
    const tags = resolveImageTag({ ...baseInput, stage: 'production' });
    expect(tags.api).toBe(
      '409171461008.dkr.ecr.us-east-2.amazonaws.com/causeflow-production:abcdef1'
    );
    expect(tags.worker).toBe(
      '409171461008.dkr.ecr.us-east-2.amazonaws.com/causeflow-production:worker-abcdef1'
    );
  });

  it('accepts a 7-char short SHA as input', () => {
    const tags = resolveImageTag({ ...baseInput, sha: '1234567', stage: 'staging' });
    expect(tags.shortSha).toBe('1234567');
    expect(tags.api).toBe(
      '409171461008.dkr.ecr.us-east-2.amazonaws.com/causeflow-staging:1234567'
    );
  });

  it('rejects uppercase hex', () => {
    expect(() =>
      resolveImageTag({ ...baseInput, sha: 'ABCDEF1', stage: 'staging' })
    ).toThrow(ConfigError);
  });

  it('rejects short SHAs (< 7 chars)', () => {
    expect(() =>
      resolveImageTag({ ...baseInput, sha: 'abcdef', stage: 'staging' })
    ).toThrow(ConfigError);
  });

  it('rejects non-hex characters', () => {
    expect(() =>
      resolveImageTag({ ...baseInput, sha: 'zzzzzzz', stage: 'staging' })
    ).toThrow(ConfigError);
  });

  it('rejects malformed account ids', () => {
    expect(() =>
      resolveImageTag({ ...baseInput, accountId: '12345', stage: 'staging' })
    ).toThrow(ConfigError);
  });

  it('rejects unknown stages', () => {
    // @ts-expect-error — intentionally passing an invalid stage
    expect(() => resolveImageTag({ ...baseInput, stage: 'prod' })).toThrow(ConfigError);
  });

  it('uses only the first 7 chars for the tag', () => {
    const tags = resolveImageTag({
      ...baseInput,
      sha: '1234567890abcdef1234567890abcdef12345678',
      stage: 'staging',
    });
    expect(tags.shortSha).toBe('1234567');
    expect(tags.api.endsWith(':1234567')).toBe(true);
    expect(tags.worker.endsWith(':worker-1234567')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { SITE } from './site';

describe('SITE constants', () => {
  it('should have correct company LinkedIn URL', () => {
    expect(SITE.social.linkedin).toBe('https://www.linkedin.com/company/causeflow-ai/');
  });

  it('should not have a twitter property', () => {
    expect('twitter' in SITE.social).toBe(false);
  });
});

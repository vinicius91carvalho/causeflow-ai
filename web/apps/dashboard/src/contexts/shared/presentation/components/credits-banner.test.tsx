import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CreditsBanner, CreditsBannerSkeleton } from './credits-banner';

const source = readFileSync(join(__dirname, 'credits-banner.tsx'), 'utf-8');

describe('CreditsBanner (AC-074 OSS no-op)', () => {
  it('renders nothing so operators never see remaining-credit limits', () => {
    expect(CreditsBanner({})).toBeNull();
    expect(CreditsBannerSkeleton()).toBeNull();
  });

  it('source has no credits remaining chrome copy', () => {
    expect(source).not.toContain('credits remaining');
    expect(source).not.toContain('investigations left');
    expect(source).not.toContain('/dashboard/billing');
  });
});

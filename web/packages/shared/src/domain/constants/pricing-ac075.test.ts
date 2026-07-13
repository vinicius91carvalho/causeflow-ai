/**
 * AC-075 — Commercial Stripe/plan/credits codepaths purged (marketing).
 * Pricing plan CTAs must point to self-host docs / GitHub, not paid checkout.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PRICING_PLANS } from './pricing';

const pricingPageSource = readFileSync(
  fileURLToPath(
    new URL(
      '../../../../../apps/website/src/contexts/marketing/presentation/pages/pricing-page.tsx',
      import.meta.url,
    ),
  ),
  'utf8',
);

describe('PRICING_PLANS (AC-075 OSS marketing)', () => {
  it('uses self-host CTAs instead of commercial checkout labels', () => {
    const starter = PRICING_PLANS.find((p) => p.id === 'starter');
    const enterprise = PRICING_PLANS.find((p) => p.id === 'enterprise');
    expect(starter?.cta).toBe('Self-host');
    expect(enterprise?.cta).toBe('View on GitHub');
    expect(PRICING_PLANS.some((p) => p.cta === 'Create Account')).toBe(false);
    expect(PRICING_PLANS.some((p) => p.cta === 'Talk to Sales')).toBe(false);
  });
});

describe('pricing-page (AC-075 OSS marketing)', () => {
  it('links plan CTAs to docs/GitHub instead of dashboard sign-up', () => {
    expect(pricingPageSource).toContain('SITE.docsUrl');
    expect(pricingPageSource).toContain('SITE.social.github');
    expect(pricingPageSource).not.toContain('getDashboardUrl');
    expect(pricingPageSource).not.toContain('/sign-up');
  });

  it('surfaces OSS self-host banner copy', () => {
    expect(pricingPageSource).toContain("t('oss.bannerTitle')");
    expect(pricingPageSource).toContain("t('oss.ctaSelfHost')");
  });
});

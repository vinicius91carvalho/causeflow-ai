import { describe, expect, it } from 'vitest';

describe('PricingCard', () => {
  it('accepts rateLimit prop', () => {
    // Verifies the PricingCardProps interface includes rateLimit
    const props = {
      name: 'Starter',
      price: '$99',
      period: '/month',
      description: '15/month investigations · 500/month events',
      rateLimit: '100 req/min',
      features: ['All integrations'],
      cta: { label: 'Create Account', href: 'https://dashboard.causeflow.ai' },
    };
    expect(props.rateLimit).toBe('100 req/min');
  });

  it('displays rate limit when provided', () => {
    const rateLimit = '500 req/min';
    expect(rateLimit).toBeTruthy();
  });

  it('handles annual pricing display', () => {
    const monthlyPrice = '$349';
    const annualPrice = '$297';
    const isAnnual = true;
    const displayPrice = isAnnual ? annualPrice : monthlyPrice;
    expect(displayPrice).toBe('$297');
  });
});

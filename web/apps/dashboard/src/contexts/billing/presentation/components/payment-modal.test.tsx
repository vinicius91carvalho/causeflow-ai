import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, 'payment-modal.tsx'), 'utf-8');

describe('payment-modal', () => {
  it('does not mount a Stripe payment element', () => {
    expect(source).not.toMatch(/PaymentElement/);
    expect(source).not.toMatch(/loadStripe/);
    expect(source).not.toMatch(/useStripe/);
    expect(source).not.toMatch(/from ['"]@str/);
  });

  it('renders Billing disabled in OSS build panel', () => {
    expect(source).toContain('Billing disabled in OSS build');
  });

  it('POSTs to /api/billing/checkout', () => {
    expect(source).toContain('/api/billing/checkout');
  });

  it('exports PaymentModal component', () => {
    expect(source).toMatch(/export.*PaymentModal/);
  });
});

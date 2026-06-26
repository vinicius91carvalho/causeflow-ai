import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, 'payment-modal.tsx'), 'utf-8');

describe('payment-modal', () => {
  it('uses cleric DS primary color for Stripe Elements (no hardcoded emerald)', () => {
    expect(source).not.toContain('#059669');
    expect(source).toContain('hsl(232');
  });

  it('exports PaymentModal component', () => {
    expect(source).toMatch(/export.*PaymentModal/);
  });
});

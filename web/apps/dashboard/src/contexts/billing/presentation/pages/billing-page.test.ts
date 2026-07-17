import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, './billing-page.tsx'), 'utf-8');

describe('billing-page (root AC-009 OSS commercial removal)', () => {
  it('hard-removes billing with notFound and does not mount commercial UI', () => {
    expect(source).toContain('notFound()');
    expect(source).not.toContain("redirect('/dashboard')");
    expect(source).not.toContain('billing-content');
    expect(source).not.toContain('PlanCard');
    expect(source).not.toContain('QuotaPack');
    expect(source).not.toContain('Buy more');
    expect(source).not.toContain('InvoicesTable');
    expect(source).not.toContain('PaymentModal');
    expect(source).not.toContain('payment-modal');
  });
});

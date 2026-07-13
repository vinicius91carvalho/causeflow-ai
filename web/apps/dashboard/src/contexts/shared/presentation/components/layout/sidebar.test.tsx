import { describe, expect, it } from 'vitest';

describe('Sidebar (AC-073 OSS commercial removal)', () => {
  it('exports Sidebar as a named export', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./sidebar.tsx', import.meta.url), 'utf-8');
    expect(source).toContain('export function Sidebar');
  });

  it('has no Billing nav entry', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./sidebar.tsx', import.meta.url), 'utf-8');
    expect(source).not.toContain("key: 'billing'");
    expect(source).not.toContain('/dashboard/billing');
    expect(source).not.toContain('CreditCard');
  });

  it('has no investigations-left / credits remaining chrome', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(new URL('./sidebar.tsx', import.meta.url), 'utf-8');
    expect(source).not.toContain('useCredits');
    expect(source).not.toContain('creditsValue');
    expect(source).not.toContain('creditsRemaining');
    expect(source).not.toContain('sidebar.credits');
  });
});

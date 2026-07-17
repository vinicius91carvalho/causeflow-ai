import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, './beta-waitlist-page.tsx'), 'utf-8');
const route = readFileSync(
  resolve(__dirname, '../../../../app/[locale]/beta-waitlist/page.tsx'),
  'utf-8',
);

describe('beta-waitlist-page (root AC-010 OSS commercial removal)', () => {
  it('hard-removes /beta-waitlist with notFound and does not mount early-access UX', () => {
    expect(source).toContain('notFound()');
    expect(source).not.toContain("We're in beta");
    expect(source).not.toContain('private beta');
    expect(source).not.toContain('adm@causeflow.ai');
    expect(route).toContain('beta-waitlist-page');
    expect(route).not.toContain('metadata');
  });
});

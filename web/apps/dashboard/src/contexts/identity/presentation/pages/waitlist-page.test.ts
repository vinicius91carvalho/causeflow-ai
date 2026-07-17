import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, './waitlist-page.tsx'), 'utf-8');
const route = readFileSync(
  resolve(__dirname, '../../../../app/[locale]/waitlist/[[...waitlist]]/page.tsx'),
  'utf-8',
);

describe('waitlist-page (root AC-010 OSS commercial removal)', () => {
  it('hard-removes /waitlist with notFound and does not mount early-access UX', () => {
    expect(source).toContain('notFound()');
    expect(source).not.toContain('Join the Waitlist');
    expect(source).not.toContain('early access');
    expect(source).not.toContain('Sign up now');
    expect(route).toContain('waitlist-page');
  });
});

/**
 * Source-level contract tests for AboutPage.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./about-page.tsx', import.meta.url)), 'utf-8');

describe('AboutPage source contract', () => {
  it('reads authored copy from about.* i18n namespace', () => {
    expect(source).toMatch(/useTranslations\('about'\)/);
  });

  it('renders mission, story, differentiators, founder sections', () => {
    expect(source).toMatch(/mission/);
    expect(source).toMatch(/story/);
    expect(source).toMatch(/different/);
    expect(source).toMatch(/founder/);
  });

  it('surfaces LinkedIn links for founder and company', () => {
    expect(source).toMatch(/linkedinUrl/);
    expect(source).toMatch(/linkedinLabel/);
  });

  it('links final CTA to OSS docs and GitHub (AC-079)', () => {
    expect(source).toMatch(/ossMarketingDocsCta/);
    expect(source).toMatch(/ossMarketingGitHubCta/);
    expect(source).not.toMatch(/getDashboardUrl/);
    expect(source).not.toMatch(/sign-up/);
    expect(source).not.toMatch(/ROUTES\.PRICING/);
  });
});

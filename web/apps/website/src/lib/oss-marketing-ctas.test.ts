import { SITE } from '@causeflow/shared/constants';
import { describe, expect, it } from 'vitest';
import {
  OSS_MARKETING_DOCS_HREF,
  OSS_MARKETING_GITHUB_HREF,
  ossMarketingDocsCta,
  ossMarketingGitHubCta,
} from './oss-marketing-ctas';

describe('oss-marketing-ctas (AC-079)', () => {
  it('points primary CTA at published docs', () => {
    expect(OSS_MARKETING_DOCS_HREF).toBe(SITE.docsUrl);
    expect(ossMarketingDocsCta('Read the docs')).toEqual({
      label: 'Read the docs',
      href: SITE.docsUrl,
      external: true,
    });
  });

  it('points secondary CTA at GitHub', () => {
    expect(OSS_MARKETING_GITHUB_HREF).toBe(SITE.social.github);
    expect(ossMarketingGitHubCta('View on GitHub')).toEqual({
      label: 'View on GitHub',
      href: SITE.social.github,
      external: true,
    });
  });
});

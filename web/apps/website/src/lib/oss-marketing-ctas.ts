import { SITE } from '@causeflow/shared/constants';

/** Published OSS docs (GitHub Pages). */
export const OSS_MARKETING_DOCS_HREF = SITE.docsUrl;

/** Upstream repository for self-host / open-source usage. */
export const OSS_MARKETING_GITHUB_HREF = SITE.social.github;

export interface OssMarketingCta {
  label: string;
  href: string;
  external: true;
}

export function ossMarketingDocsCta(label: string): OssMarketingCta {
  return { label, href: OSS_MARKETING_DOCS_HREF, external: true };
}

export function ossMarketingGitHubCta(label: string): OssMarketingCta {
  return { label, href: OSS_MARKETING_GITHUB_HREF, external: true };
}

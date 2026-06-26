import type { MetadataRoute } from 'next';

const isStaging = process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE === 'staging';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://causeflow.ai';

export default function robots(): MetadataRoute.Robots {
  if (isStaging) {
    return {
      rules: { userAgent: '*', disallow: '/' },
    };
  }

  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

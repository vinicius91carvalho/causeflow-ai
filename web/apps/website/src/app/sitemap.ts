import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://causeflow.ai';

const pages = [
  '',
  '/product',
  '/security',
  '/integrations',
  '/pricing',
  '/from-opsgenie',
  '/use-cases',
  '/use-cases/stale-pricing',
  '/use-cases/broken-images',
  '/use-cases/cascading-500',
  '/privacy',
  '/terms',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    entries.push(
      {
        url: `${BASE_URL}${page}`,
        lastModified: '2026-04-19',
        changeFrequency: 'weekly',
        priority: page === '' ? 1.0 : 0.8,
      },
      {
        url: `${BASE_URL}/pt-br${page}`,
        lastModified: '2026-04-19',
        changeFrequency: 'weekly',
        priority: page === '' ? 0.9 : 0.7,
      },
    );
  }

  return entries;
}

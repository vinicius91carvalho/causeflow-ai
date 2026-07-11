import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://causeflow.ai';

interface PageMetadataOptions {
  title: string;
  description: string;
  path: string;
  locale?: string;
}

export function generatePageMetadata({
  title,
  description,
  path,
  locale = 'en',
}: PageMetadataOptions): Metadata {
  const url = locale === 'en' ? `${BASE_URL}${path}` : `${BASE_URL}/${locale}${path}`;
  const alternateEn = `${BASE_URL}${path}`;
  const alternatePtBr = `${BASE_URL}/pt-br${path}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: { en: alternateEn, 'pt-br': alternatePtBr, 'x-default': alternateEn },
    },
    openGraph: {
      title: `${title} | CauseFlow AI`,
      description,
      url,
      siteName: 'CauseFlow AI',
      locale: locale === 'en' ? 'en_US' : 'pt_BR',
      type: 'website',
      images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | CauseFlow AI`,
      description,
    },
    ...(process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE === 'staging' && {
      robots: { index: false, follow: false },
    }),
  };
}

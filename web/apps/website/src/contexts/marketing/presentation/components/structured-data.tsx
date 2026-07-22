interface StructuredDataProps {
  data: Record<string, unknown>;
}

export function StructuredData({ data }: StructuredDataProps) {
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires dangerouslySetInnerHTML
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'CauseFlow AI',
  url: 'https://causeflow.ai',
  logo: 'https://causeflow.ai/logo.png',
  description:
    'Open-source AI incident investigation for engineering teams. Self-host CauseFlow and find root causes in minutes.',
  sameAs: [
    'https://github.com/vinicius91carvalho/causeflow-ai',
    'https://www.linkedin.com/company/causeflow-ai/',
  ],
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'CauseFlow AI',
  alternateName: 'CauseFlow Open Source',
  url: 'https://causeflow.ai',
  description:
    'Open-source AI-powered incident investigation. Self-host with Docker Compose and connect the tools your team already uses.',
};

/** SoftwareApplication JSON-LD — signals free/open-source product to search engines. */
export const softwareApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'CauseFlow AI',
  applicationCategory: 'DeveloperApplication',
  applicationSubCategory: 'Incident Investigation',
  operatingSystem: 'Linux, Docker',
  url: 'https://causeflow.ai',
  downloadUrl: 'https://github.com/vinicius91carvalho/causeflow-ai',
  installUrl: 'https://vinicius91carvalho.github.io/causeflow-ai/docs/',
  isAccessibleForFree: true,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  description:
    'Open-source AI incident investigation platform. Specialized agents cross-reference Slack, GitHub, Jira, and CloudWatch to find root causes in minutes.',
  sameAs: ['https://github.com/vinicius91carvalho/causeflow-ai'],
};

export const softwareSourceCodeSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareSourceCode',
  name: 'CauseFlow AI',
  codeRepository: 'https://github.com/vinicius91carvalho/causeflow-ai',
  programmingLanguage: ['TypeScript', 'Python'],
  runtimePlatform: 'Docker',
  description:
    'Open-source monorepo for CauseFlow: AI incident investigation Core API, dashboard, marketing site, and public docs.',
};

export function generateFAQSchema(items: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

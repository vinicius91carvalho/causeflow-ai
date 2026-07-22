export const SITE = {
  name: 'CauseFlow AI',
  tagline: 'Open-Source Incident Investigation',
  description:
    'Open-source AI incident investigation for engineering teams. Self-host CauseFlow and find root causes in minutes.',
  url: 'https://causeflow.ai',
  // Falls back to production URL; override via NEXT_PUBLIC_DASHBOARD_URL env var.
  dashboardUrl: process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://dashboard.causeflow.ai',
  /** Published OSS docs (GitHub Pages under /docs). */
  docsUrl: 'https://vinicius91carvalho.github.io/causeflow-ai/docs/',
  /**
   * Canonical Test Application (OSS) docs page (AC-020 / AC-023).
   * Integrations "Learn more" deep-links here.
   */
  testApplicationDocsUrl:
    'https://vinicius91carvalho.github.io/causeflow-ai/docs/integrations/test-application',
  email: 'adm@causeflow.ai',
  social: {
    github: 'https://github.com/vinicius91carvalho/causeflow-ai',
    linkedin: 'https://www.linkedin.com/in/vinicius-carvalho-a04b46116',
  },
  cofounder: {
    name: 'Vinicius Carvalho',
    linkedin: 'https://www.linkedin.com/in/vinicius-carvalho-a04b46116',
    calcom: 'https://cal.com/causeflowai/15min',
  },
} as const;

export const TERMS_VERSION = 'v2026.03.06';

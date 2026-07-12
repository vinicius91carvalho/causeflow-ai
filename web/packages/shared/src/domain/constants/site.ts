export const SITE = {
  name: 'CauseFlow AI',
  tagline: "Your Stack's Problem Detective",
  description: 'AI-powered incident investigation for engineering teams of 2-50 engineers.',
  url: 'https://causeflow.ai',
  // Falls back to production URL; override via NEXT_PUBLIC_DASHBOARD_URL env var.
  dashboardUrl: process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://dashboard.causeflow.ai',
  /** Published OSS docs (GitHub Pages). */
  docsUrl: 'https://vinicius91carvalho.github.io/causeflow-ai/',
  email: 'adm@causeflow.ai',
  social: {
    github: 'https://github.com/causeflow',
    linkedin: 'https://www.linkedin.com/company/causeflow-ai/',
  },
  cofounder: {
    name: 'Vinicius Carvalho',
    linkedin: 'https://www.linkedin.com/in/vinicius-carvalho-a04b46116',
    calcom: 'https://cal.com/causeflowai/15min',
  },
} as const;

export const TERMS_VERSION = 'v2026.03.06';

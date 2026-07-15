import { Briefcase, Plug } from 'lucide-react';

export interface SetupStep {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  completed?: boolean;
}

/** OSS-safe setup steps — no paid-plan selection copy (AC-083). */
export const BASE_SETUP_STEPS: SetupStep[] = [
  {
    icon: Plug,
    title: 'Set Up Integrations',
    description: 'Connect your tools to get the most out of CauseFlow.',
    href: '/onboarding/integrations',
  },
  {
    icon: Briefcase,
    title: 'Complete Business Profile',
    description: 'Tell us about your team so we can tailor your experience.',
    href: '/onboarding/business-profile',
  },
];

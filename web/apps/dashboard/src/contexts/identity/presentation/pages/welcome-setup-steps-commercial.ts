import { CreditCard } from 'lucide-react';
import { BASE_SETUP_STEPS, type SetupStep } from './welcome-setup-steps';

/** Commercial-only choose-plan step — never imported on the OSS welcome path (AC-083). */
const CHOOSE_PLAN_STEP: SetupStep = {
  icon: CreditCard,
  title: 'Choose Your Plan',
  description: 'Select a plan that fits your team size and usage needs.',
  href: '/onboarding/choose-plan',
};

export function getCommercialSetupSteps(): SetupStep[] {
  return [...BASE_SETUP_STEPS, CHOOSE_PLAN_STEP];
}

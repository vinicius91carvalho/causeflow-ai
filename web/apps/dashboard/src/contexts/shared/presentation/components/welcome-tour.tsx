'use client';

/**
 * @deprecated Replaced by OnboardingOrchestrator in the onboarding bounded context.
 * The new system provides a persistent checklist instead of a linear tour.
 * This component is kept as a no-op to avoid breaking any remaining imports.
 * @see @/contexts/onboarding/presentation/components/onboarding-orchestrator
 */
export function WelcomeTour() {
  return null;
}

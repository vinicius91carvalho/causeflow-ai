/**
 * Onboarding Domain Types
 *
 * Defines the tutorial wizard steps. Each step is presented as a modal
 * with Next/Previous navigation. No floating checklist.
 */

// ---------------------------------------------------------------------------
// Tutorial Steps (modal wizard)
// ---------------------------------------------------------------------------

export interface TutorialStep {
  /** i18n key under `onboarding.steps.<key>` */
  key: string;
  /** Lucide icon name */
  icon: string;
}

/** Ordered tutorial steps shown in the modal wizard */
export const TUTORIAL_STEPS: TutorialStep[] = [
  { key: 'welcome', icon: 'Sparkles' },
  { key: 'integrations', icon: 'Plug' },
  { key: 'relay', icon: 'Radio' },
  { key: 'firstIncident', icon: 'ShieldAlert' },
  { key: 'billing', icon: 'CreditCard' },
  { key: 'complete', icon: 'Trophy' },
];

/** Tutorial steps that mention paid plans / billing — omitted in OSS (AC-083). */
export const OSS_EXCLUDED_TUTORIAL_STEP_KEYS = ['billing'] as const;

/** Returns tutorial steps for the current runtime (commercial vs OSS). */
export function getTutorialSteps(oss: boolean): TutorialStep[] {
  if (!oss) return TUTORIAL_STEPS;
  return TUTORIAL_STEPS.filter((step) => step.key !== 'billing');
}

// ---------------------------------------------------------------------------
// Legacy types (kept for repository/hook compatibility)
// ---------------------------------------------------------------------------

export type StepKey =
  | 'welcome'
  | 'integrations'
  | 'relay'
  | 'firstIncident'
  | 'receiveEvents'
  | 'billing'
  | 'complete';

export type OnboardingStepStatus = 'pending' | 'completed' | 'skipped';

export const STEP_KEYS: StepKey[] = [
  'welcome',
  'integrations',
  'relay',
  'firstIncident',
  'receiveEvents',
  'billing',
  'complete',
];

export interface OnboardingStepConfig {
  href: string;
  labelKey: string;
  icon: string;
}

export const STEP_CONFIG: Record<StepKey, OnboardingStepConfig> = {
  welcome: { href: '', labelKey: 'welcome', icon: 'Sparkles' },
  integrations: { href: '/dashboard/integrations', labelKey: 'integrations', icon: 'Plug' },
  relay: { href: '/dashboard/relay', labelKey: 'relay', icon: 'Radio' },
  firstIncident: { href: '/dashboard/incidents', labelKey: 'firstIncident', icon: 'ShieldAlert' },
  receiveEvents: { href: '/dashboard/integrations', labelKey: 'receiveEvents', icon: 'Activity' },
  billing: { href: '/dashboard/billing', labelKey: 'billing', icon: 'CreditCard' },
  complete: { href: '', labelKey: 'complete', icon: 'Trophy' },
};

// ---------------------------------------------------------------------------
// Progress Model
// ---------------------------------------------------------------------------

export interface OnboardingProgress {
  steps: Record<StepKey, OnboardingStepStatus>;
  currentStep: StepKey;
  completed: boolean;
  skipped: boolean;
  startedAt: string;
  completedAt?: string;
}

export function createInitialProgress(): OnboardingProgress {
  const steps = {} as Record<StepKey, OnboardingStepStatus>;
  for (const key of STEP_KEYS) {
    steps[key] = 'pending';
  }
  return {
    steps,
    currentStep: 'welcome',
    completed: false,
    skipped: false,
    startedAt: new Date().toISOString(),
  };
}

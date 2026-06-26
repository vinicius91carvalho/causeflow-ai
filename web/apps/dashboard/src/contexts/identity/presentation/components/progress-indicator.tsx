'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type OnboardingStep = 1 | 2 | 3;

interface ProgressIndicatorProps {
  currentStep: OnboardingStep;
}

interface Step {
  number: OnboardingStep;
  labelKey: string;
}

const STEPS: Step[] = [
  { number: 1, labelKey: 'steps.profile' },
  { number: 2, labelKey: 'steps.integration' },
  { number: 3, labelKey: 'steps.welcome' },
];

/**
 * Onboarding progress indicator.
 * Shows 3 steps: Profile, Integration, Welcome.
 * Current step is highlighted, completed steps show a checkmark.
 * Responsive: horizontal on desktop, compact on mobile.
 */
export function ProgressIndicator({ currentStep }: ProgressIndicatorProps) {
  const t = useTranslations('dashboard.onboarding.progress');

  return (
    <nav
      aria-label={t('ariaLabel')}
      className="flex items-center justify-center gap-0 w-full max-w-sm mx-auto"
    >
      {STEPS.map((step, index) => {
        const isCompleted = step.number < currentStep;
        const isCurrent = step.number === currentStep;

        return (
          <div key={step.number} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all duration-200',
                  isCompleted
                    ? 'bg-primary text-primary-foreground'
                    : isCurrent
                      ? 'border-2 border-primary bg-primary/10 text-primary animate-pulse'
                      : 'border-2 border-muted-foreground/30 bg-muted text-muted-foreground',
                ].join(' ')}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <span aria-hidden="true">{step.number}</span>
                )}
              </div>
              {/* Step label — hidden on smallest screens */}
              <span
                className={[
                  'hidden sm:block text-xs font-medium text-center whitespace-nowrap',
                  isCurrent
                    ? 'text-primary'
                    : isCompleted
                      ? 'text-foreground'
                      : 'text-muted-foreground',
                ].join(' ')}
              >
                {t(step.labelKey)}
              </span>
            </div>

            {/* Connector line between steps */}
            {index < STEPS.length - 1 && (
              <div
                className={[
                  'h-0.5 w-12 sm:w-16 mx-2 rounded-full transition-colors duration-200',
                  isCompleted ? 'bg-primary' : 'bg-muted-foreground/20',
                ].join(' ')}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

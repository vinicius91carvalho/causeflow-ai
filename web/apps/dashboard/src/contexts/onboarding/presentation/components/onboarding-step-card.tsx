'use client';

import {
  Activity,
  Check,
  CreditCard,
  Plug,
  Radio,
  ShieldAlert,
  SkipForward,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { OnboardingStepStatus, StepKey } from '../../domain/types';
import { STEP_CONFIG } from '../../domain/types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Plug,
  Radio,
  ShieldAlert,
  Activity,
  CreditCard,
  Trophy,
};

interface OnboardingStepCardProps {
  stepKey: StepKey;
  status: OnboardingStepStatus;
  onStepClick: (stepKey: StepKey) => void;
}

export function OnboardingStepCard({ stepKey, status, onStepClick }: OnboardingStepCardProps) {
  const t = useTranslations('dashboard.onboarding');
  const config = STEP_CONFIG[stepKey];
  const Icon = ICON_MAP[config.icon] ?? Sparkles;

  const statusClass =
    status === 'completed'
      ? 'onboarding-step-card--completed'
      : status === 'skipped'
        ? 'onboarding-step-card--skipped'
        : '';

  return (
    <button
      type="button"
      className={`onboarding-step-card ${statusClass}`}
      onClick={() => onStepClick(stepKey)}
      aria-label={t(`steps.${config.labelKey}.title`)}
    >
      <div className="onboarding-step-card__icon">
        <Icon className="h-4 w-4" />
      </div>
      <div className="onboarding-step-card__content">
        <div className="onboarding-step-card__title">{t(`steps.${config.labelKey}.title`)}</div>
        <div className="onboarding-step-card__description">
          {t(`steps.${config.labelKey}.description`)}
        </div>
      </div>
      <div className="onboarding-step-card__status">
        {status === 'completed' && <Check className="h-4 w-4 text-primary" />}
        {status === 'skipped' && <SkipForward className="h-3 w-3 text-muted-foreground" />}
        {status === 'pending' && config.href && (
          <span className="onboarding-step-card__go-btn">{t('highlight.markDone')}</span>
        )}
      </div>
    </button>
  );
}

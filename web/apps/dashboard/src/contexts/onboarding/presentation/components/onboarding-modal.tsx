'use client';

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Plug,
  Radio,
  ShieldAlert,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect } from 'react';
import { signUpConfetti } from '@/contexts/shared/lib/confetti';
import type { TutorialStep } from '../../domain/types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Plug,
  Radio,
  ShieldAlert,
  Activity,
  CreditCard,
  Trophy,
};

interface OnboardingModalProps {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onClose: () => void;
}

export function OnboardingModal({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrevious,
  onSkip,
  onClose,
}: OnboardingModalProps) {
  const t = useTranslations('dashboard.onboarding');

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;
  const Icon = ICON_MAP[step.icon] ?? Sparkles;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && !isLast) onNext();
      if (e.key === 'ArrowLeft' && !isFirst) onPrevious();
    },
    [onClose, onNext, onPrevious, isFirst, isLast],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Fire end-of-tutorial confetti on last step (two side cannons, brand colors)
  useEffect(() => {
    if (isLast) {
      signUpConfetti();
    }
  }, [isLast]);

  return (
    <div className="onboarding-modal">
      <div className="onboarding-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="onboarding-modal__card"
        role="dialog"
        aria-modal="true"
        aria-label={t(`steps.${step.key}.title`)}
      >
        <button
          type="button"
          className="onboarding-modal__close-btn"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Step indicator */}
        <span className="onboarding-modal__badge">
          {t('wizard.stepOf', { current: stepIndex + 1, total: totalSteps })}
        </span>

        <h2 className="onboarding-modal__title">{t(`steps.${step.key}.title`)}</h2>
        <p className="onboarding-modal__description">{t(`steps.${step.key}.description`)}</p>

        {/* Icon — below the step content */}
        <div className="onboarding-modal__icon">
          <Icon className="h-6 w-6" />
        </div>

        {/* Progress dots — below icon, above nav */}
        <div className="onboarding-modal__dots">
          {Array.from({ length: totalSteps }, (_, i) => (
            <span
              key={`onboarding-dot-${i}`}
              className={`onboarding-modal__dot ${i === stepIndex ? 'onboarding-modal__dot--active' : ''} ${i < stepIndex ? 'onboarding-modal__dot--done' : ''}`}
            />
          ))}
        </div>

        {/* Navigation — stacked below dots */}
        <div className="onboarding-modal__nav">
          {!isLast ? (
            <button type="button" className="onboarding-modal__nav-btn--primary" onClick={onNext}>
              {isFirst ? t('wizard.begin') : t('wizard.next')}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" className="onboarding-modal__nav-btn--primary" onClick={onClose}>
              {t('wizard.finish')}
            </button>
          )}

          {!isFirst && (
            <button
              type="button"
              className="onboarding-modal__nav-btn--secondary"
              onClick={onPrevious}
            >
              <ArrowLeft className="h-4 w-4" />
              {t('wizard.previous')}
            </button>
          )}
        </div>

        {/* Skip */}
        <button type="button" className="onboarding-modal__secondary" onClick={onSkip}>
          {t('wizard.skip')}
        </button>
      </div>
    </div>
  );
}

'use client';

import { ChevronUp, Minimize2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { OnboardingProgress, StepKey } from '../../domain/types';
import { STEP_KEYS } from '../../domain/types';
import { OnboardingStepCard } from './onboarding-step-card';

interface OnboardingChecklistProps {
  progress: OnboardingProgress;
  onStepClick: (stepKey: StepKey) => void;
  onSkip: () => void;
  onDismiss: () => void;
}

export function OnboardingChecklist({
  progress,
  onStepClick,
  onSkip,
  onDismiss,
}: OnboardingChecklistProps) {
  const t = useTranslations('dashboard.onboarding');
  const [minimized, setMinimized] = useState(false);

  const completedCount = STEP_KEYS.filter(
    (k) => progress.steps[k] === 'completed' || progress.steps[k] === 'skipped',
  ).length;
  const totalCount = STEP_KEYS.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  if (minimized) {
    return (
      <div className="onboarding-checklist onboarding-checklist--minimized">
        <button
          type="button"
          className="onboarding-checklist__fab"
          onClick={() => setMinimized(false)}
          aria-label={t('checklist.expand')}
        >
          <span className="onboarding-checklist__fab-badge">
            {completedCount}/{totalCount}
          </span>
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="onboarding-checklist">
      {/* Header */}
      <div className="onboarding-checklist__header">
        <h3 className="onboarding-checklist__title">{t('checklist.title')}</h3>
        <div className="onboarding-checklist__actions">
          <button
            type="button"
            className="onboarding-checklist__action-btn"
            onClick={() => setMinimized(true)}
            aria-label={t('checklist.minimize')}
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="onboarding-checklist__action-btn"
            onClick={onDismiss}
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="onboarding-checklist__progress">
        <div className="onboarding-checklist__progress-bar">
          <div
            className="onboarding-checklist__progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="onboarding-checklist__progress-text">
          {t('checklist.progress', { completed: completedCount, total: totalCount })}
        </div>
      </div>

      {/* Steps */}
      <div className="onboarding-checklist__steps">
        {STEP_KEYS.map((key) => (
          <OnboardingStepCard
            key={key}
            stepKey={key}
            status={progress.steps[key]}
            onStepClick={onStepClick}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="onboarding-checklist__footer">
        <button type="button" className="onboarding-checklist__skip-btn" onClick={onSkip}>
          {t('checklist.skip')}
        </button>
      </div>
    </div>
  );
}

'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isOssBuildClient } from '@/contexts/billing/application/oss-runtime';
import { getTutorialSteps } from '../../domain/types';
import { useOnboardingProgress } from '../hooks/use-onboarding-progress';
import { OnboardingModal } from './onboarding-modal';
import './onboarding.css';

/**
 * Onboarding wizard — modal-only step-by-step tutorial.
 * No floating checklist. Steps navigate with Next/Previous.
 *
 * Triggers:
 * - ?welcome=1 URL param (sign-up redirect)
 * - causeflow:restart-tutorial custom event (profile menu)
 */
export function OnboardingOrchestrator() {
  const searchParams = useSearchParams();
  const { progress, loading, startOnboarding, resetOnboarding, skipAll } = useOnboardingProgress();
  const tutorialSteps = useMemo(() => getTutorialSteps(isOssBuildClient()), []);

  const [showWizard, setShowWizard] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const hasProcessedWelcome = useRef(false);

  // Listen for manual tutorial restart from topbar profile menu
  useEffect(() => {
    const handleRestart = () => {
      resetOnboarding();
      setCurrentStep(0);
      setShowWizard(true);
    };
    window.addEventListener('causeflow:restart-tutorial', handleRestart);
    return () => window.removeEventListener('causeflow:restart-tutorial', handleRestart);
  }, [resetOnboarding]);

  // Detect ?welcome=1 and start onboarding
  useEffect(() => {
    if (hasProcessedWelcome.current) return;
    if (loading) return;

    const isWelcome = searchParams.get('welcome') === '1';
    if (!isWelcome) return;

    hasProcessedWelcome.current = true;

    // Clean URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('welcome');
      window.history.replaceState({}, '', url.toString());
    }

    // Start onboarding and show wizard
    // (End-of-tutorial confetti fires from OnboardingModal on the final step.)
    startOnboarding();
    setCurrentStep(0);
    setShowWizard(true);
  }, [loading, searchParams, startOnboarding]);

  // Auto-show wizard for brand-new users (progress === null).
  // This is a safety net in case the ?welcome=1 param is lost during the
  // sign-up → create-org → /dashboard redirect chain (OSS skips choose-plan).
  // (e.g., middleware locale rewrites, manual nav).
  // Once the user starts, skips, or completes onboarding, localStorage has
  // a progress entry and this effect no-ops on subsequent mounts.
  useEffect(() => {
    if (loading) return;
    if (progress === null && !showWizard && !hasProcessedWelcome.current) {
      hasProcessedWelcome.current = true;
      startOnboarding();
      setCurrentStep(0);
      setShowWizard(true);
    }
  }, [loading, progress, showWizard, startOnboarding]);

  const handleNext = useCallback(() => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, tutorialSteps.length]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    skipAll();
    setShowWizard(false);
  }, [skipAll]);

  const handleClose = useCallback(() => {
    setShowWizard(false);
  }, []);

  if (!showWizard) return null;

  const step = tutorialSteps[currentStep];
  if (!step) return null;

  return (
    <OnboardingModal
      step={step}
      stepIndex={currentStep}
      totalSteps={tutorialSteps.length}
      onNext={handleNext}
      onPrevious={handlePrevious}
      onSkip={handleSkip}
      onClose={handleClose}
    />
  );
}

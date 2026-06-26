'use client';

import { cn } from '@causeflow/ui/lib';
import { Button } from '@causeflow/ui/primitives';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildZodSchemaForStep } from '@/contexts/onboarding/application/build-zod-from-schema';
import { resolveLocalizedSchema } from '@/contexts/onboarding/application/resolve-localized-schema';
import type {
  BusinessProfileFormSchema,
  SupportedLocale,
} from '@/contexts/onboarding/domain/business-profile-types';
import {
  clearDraft,
  loadDraft,
  saveDraft,
} from '@/contexts/onboarding/presentation/hooks/use-business-profile-draft';
import { StepRenderer } from './step-renderer';

interface BusinessProfileWizardProps {
  schema: BusinessProfileFormSchema;
  locale: SupportedLocale;
  initialAnswers?: Record<string, unknown>;
  onSubmit: (answers: Record<string, unknown>, locale: SupportedLocale) => Promise<void>;
  onSkip: () => void;
}

export function BusinessProfileWizard({
  schema,
  locale,
  initialAnswers,
  onSubmit,
  onSkip,
}: BusinessProfileWizardProps) {
  // Resolve schema to active locale — re-computed only when schema or locale changes
  const resolvedSchema = useMemo(() => resolveLocalizedSchema(schema, locale), [schema, locale]);

  const totalSteps = resolvedSchema.steps.length;

  // Restore draft from localStorage on mount (draft key is per-version, not per-locale)
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    if (initialAnswers && Object.keys(initialAnswers).length > 0) return initialAnswers;
    return loadDraft(schema.version) ?? {};
  });

  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const currentStep = resolvedSchema.steps[stepIndex];

  // Auto-save draft on every answer change (per-version key, locale-agnostic)
  useEffect(() => {
    saveDraft(schema.version, answers);
  }, [answers, schema.version]);

  function handleFieldChange(fieldId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    // Clear error for the changed field
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  }

  /** Validate the current step before advancing. Returns true if valid. */
  function validateCurrentStep(): boolean {
    const stepSchema = buildZodSchemaForStep(currentStep, answers);
    const result = stepSchema.safeParse(answers);
    if (result.success) {
      setErrors({});
      return true;
    }
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    setErrors(fieldErrors);
    return false;
  }

  function handleNext() {
    if (!validateCurrentStep()) return;
    setErrors({});
    setStepIndex((i) => Math.min(i + 1, totalSteps - 1));
  }

  function handleBack() {
    setErrors({});
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  const handleSubmit = useCallback(async () => {
    if (!validateCurrentStep()) return;
    setSubmitting(true);
    try {
      await onSubmit(answers, locale);
      clearDraft(schema.version);
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, locale, onSubmit, schema.version, validateCurrentStep]);

  const isLastStep = stepIndex === totalSteps - 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Progress indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Step {stepIndex + 1} of {resolvedSchema.steps.length}
          </span>
          <span>{resolvedSchema.title}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className="h-1.5 rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Current step */}
      {currentStep && (
        <StepRenderer
          step={currentStep}
          values={answers}
          errors={errors}
          onChange={handleFieldChange}
        />
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-2">
          {stepIndex > 0 && (
            <Button variant="outline" size="sm" onClick={handleBack} disabled={submitting}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Skip link */}
          <button
            type="button"
            onClick={onSkip}
            disabled={submitting}
            className={cn(
              'text-sm text-muted-foreground underline-offset-2 hover:underline',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            {resolvedSchema.skipLabel ?? 'Skip for now'}
          </button>

          {isLastStep ? (
            <Button onClick={handleSubmit} disabled={submitting} size="sm">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {resolvedSchema.submitLabel ?? 'Submit'}
            </Button>
          ) : (
            <Button onClick={handleNext} size="sm">
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

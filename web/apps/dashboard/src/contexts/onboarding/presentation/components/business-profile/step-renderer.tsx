'use client';

import type {
  FormFieldResolved,
  FormStepResolved,
} from '@/contexts/onboarding/domain/business-profile-types';
import { FieldRenderer } from './field-renderer';

interface StepRendererProps {
  step: FormStepResolved;
  values: Record<string, unknown>;
  errors: Record<string, string>;
  onChange: (fieldId: string, value: unknown) => void;
}

export function StepRenderer({ step, values, errors, onChange }: StepRendererProps) {
  return (
    <div className="space-y-6">
      {/* Step header */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">{step.title}</h2>
        {step.description && <p className="text-sm text-muted-foreground">{step.description}</p>}
      </div>

      {/* Fields */}
      <div className="space-y-5">
        {step.fields.map((field: FormFieldResolved) => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={(val) => onChange(field.id, val)}
            error={errors[field.id]}
            allValues={values}
          />
        ))}
      </div>
    </div>
  );
}

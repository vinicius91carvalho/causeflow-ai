'use client';
import { useCallback, useState } from 'react';
import type { ZodSchema } from 'zod';
import type { FormState, FormStatus } from '../../domain/types/form-types';
import { sanitizeFormData } from '../../infrastructure/sanitization/sanitize';

export function useForm<T extends object>(options: {
  initialData: T;
  schema: ZodSchema<T>;
  onSubmit: (data: T) => Promise<{ success: boolean; message: string }>;
}) {
  const [state, setState] = useState<FormState<T>>({
    data: options.initialData,
    status: 'idle' as FormStatus,
    errors: {},
  });

  const setField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setState((prev) => ({
      ...prev,
      data: { ...prev.data, [field]: value },
      errors: { ...prev.errors, [field]: undefined },
    }));
  }, []);

  const submit = useCallback(async () => {
    const sanitized = sanitizeFormData(state.data);
    const result = options.schema.safeParse(sanitized);

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof T, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof T;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setState((prev) => ({ ...prev, errors: fieldErrors }));
      return;
    }

    setState((prev) => ({ ...prev, status: 'submitting', errors: {} }));

    try {
      const response = await options.onSubmit(result.data);
      setState((prev) => ({
        ...prev,
        status: response.success ? 'success' : 'error',
        message: response.message,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        status: 'error',
        message: 'An unexpected error occurred.',
      }));
    }
  }, [state.data, options]);

  const reset = useCallback(() => {
    setState({ data: options.initialData, status: 'idle', errors: {} });
  }, [options.initialData]);

  return { ...state, setField, submit, reset };
}

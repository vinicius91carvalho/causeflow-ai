import { z } from 'zod';
import { STEP_KEYS } from '../domain/types';

/**
 * Zod validation schema for PATCH /api/onboarding/progress
 */
export const onboardingPatchSchema = z.object({
  /** The step to act on (required for complete/skip, optional for start/skip_all) */
  step: z.enum(STEP_KEYS as [string, ...string[]]).optional(),
  /** The action to perform */
  action: z.enum(['complete', 'skip', 'skip_all', 'start']),
});

export type OnboardingPatchInput = z.infer<typeof onboardingPatchSchema>;

import { z } from 'zod';

/**
 * Zod validation schemas for the Billing context API routes.
 */

export const checkoutSchema = z.object({
  planId: z.enum(['starter', 'pro', 'business']),
  /** When 'onboarding', success redirects to /dashboard?welcome=1 instead of /dashboard/billing */
  from: z.enum(['onboarding', 'billing']).optional().default('billing'),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

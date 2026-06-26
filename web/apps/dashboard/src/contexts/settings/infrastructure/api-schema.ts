import { z } from 'zod';

/**
 * Zod validation schemas for the Settings context API routes.
 */

export const updateSettingsSchema = z.object({
  name: z.string().min(2).optional(),
  companyName: z.string().min(2).optional(),
  websiteUrl: z.string().optional(),
  notifications: z
    .object({
      emailOnComplete: z.boolean().optional(),
      emailOnError: z.boolean().optional(),
      slackOnComplete: z.boolean().optional(),
      slackOnError: z.boolean().optional(),
    })
    .optional(),
  locale: z.enum(['en', 'pt-br']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const createApiKeySchema = z.object({ name: z.string().min(1).max(100) });

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

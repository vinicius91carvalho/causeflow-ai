import { z } from 'zod';

export const notifySchema = z.object({
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address.')
    .max(254, 'Email must be at most 254 characters.'),
  firstName: z.string().trim().max(100).optional(),
  companyName: z.string().trim().max(200).optional(),
  companyWebsite: z.string().trim().max(500).optional(),
  language: z.string().trim().max(10).optional(),
});

export type NotifySchemaType = z.infer<typeof notifySchema>;

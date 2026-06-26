import { z } from 'zod';

export const waitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address.')
    .max(254, 'Email must be at most 254 characters.'),
  firstName: z
    .string()
    .trim()
    .min(1, 'First name is required.')
    .max(100, 'First name must be at most 100 characters.'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name is required.')
    .max(100, 'Last name must be at most 100 characters.'),
  companyName: z
    .string()
    .trim()
    .min(1, 'Company name is required.')
    .max(200, 'Company name must be at most 200 characters.'),
  website: z
    .string()
    .trim()
    .max(500, 'Website must be at most 500 characters.')
    .optional()
    .or(z.literal('')),
});

export type WaitlistSchemaType = z.infer<typeof waitlistSchema>;

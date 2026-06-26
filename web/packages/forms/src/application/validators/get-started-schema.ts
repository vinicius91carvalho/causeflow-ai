import { z } from 'zod';

export const getStartedSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters.')
    .max(100, 'Full name must be at most 100 characters.'),
  workEmail: z.string().email('Please enter a valid email address.'),
  companyName: z
    .string()
    .min(1, 'Company name is required.')
    .max(200, 'Company name must be at most 200 characters.'),
  teamSize: z.enum(['1-5', '6-20', '21-50', '50+'], {
    errorMap: () => ({ message: 'Please select a team size.' }),
  }),
});

export type GetStartedSchemaType = z.infer<typeof getStartedSchema>;

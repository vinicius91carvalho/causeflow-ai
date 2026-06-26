import { z } from 'zod';

/**
 * Zod validation schemas for the Team context API routes.
 */

const userRoles = ['admin', 'member'] as const;

export const inviteTeamMemberSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(userRoles, {
    errorMap: () => ({ message: 'Role must be either admin or member' }),
  }),
});

export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;

export const changeRoleSchema = z.object({
  role: z.enum(userRoles, {
    errorMap: () => ({ message: 'Role must be either admin or member' }),
  }),
});

export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

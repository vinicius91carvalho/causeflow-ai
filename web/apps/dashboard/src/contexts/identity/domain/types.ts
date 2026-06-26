/**
 * Identity domain types.
 */

export type UserRole = 'admin' | 'member';

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  profileComplete: boolean;
  lastLogin?: string;
  createdAt: string;
}

/**
 * Valid team size values for the onboarding profile form and API validation.
 */
export const teamSizeValues = ['1_5', '6_20', '21_50', '50plus'] as const;

export type TeamSize = (typeof teamSizeValues)[number];

export interface TermsAcceptance {
  userId: string;
  tenantId: string;
  termsVersion: string;
  acceptedAt: string;
  ipAddress: string;
  userAgent: string;
}

/**
 * Team domain types.
 */

import type { UserRole } from '@/contexts/identity/domain/types';

export type { UserRole };

export type InviteStatus = 'pending' | 'accepted' | 'expired';

export interface Invite {
  tenantId: string;
  email: string;
  role: UserRole;
  invitedBy: string;
  expiresAt: string;
  status: InviteStatus;
  createdAt: string;
}

import type { TenantId } from '../../../shared/domain/value-objects.js';
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export interface Invite {
  tenantId: TenantId;
  email: string;
  invitedBy: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

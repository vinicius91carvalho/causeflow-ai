import type { TenantId } from '../../../shared/domain/value-objects.js';
export type UserRole = 'admin' | 'member';
export interface User {
    tenantId: TenantId;
    userId: string;
    email: string;
    name: string;
    role: UserRole;
    profileComplete: boolean;
    termsAcceptedAt?: string;
    createdAt: string;
    updatedAt: string;
}

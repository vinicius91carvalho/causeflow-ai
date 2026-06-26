import type { TenantId } from '../../domain/value-objects.js';
export type AppVariables = {
    tenantId: TenantId;
    userId: string;
    userEmail: string;
    userRoles: string[];
};
export type AppEnv = {
    Variables: AppVariables;
};

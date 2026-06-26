import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface PackageDependency {
    tenantId: TenantId;
    repoFullName: string;
    packageName: string;
    version: string;
    declaredIn: string;
    isDev: boolean;
    createdAt: string;
    updatedAt: string;
}

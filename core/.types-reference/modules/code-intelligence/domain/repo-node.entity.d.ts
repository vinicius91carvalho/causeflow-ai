import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface RepoNode {
    tenantId: TenantId;
    repoFullName: string;
    provider: 'github';
    language?: string;
    defaultBranch?: string;
    lastCommitSha?: string;
    lastIndexedAt?: string;
    fileCount?: number;
    config?: {
        dockerfile?: boolean;
        ci?: boolean;
        iac?: boolean;
    };
    createdAt: string;
    updatedAt: string;
}

import type { IAuditRepository } from '../domain/audit.repository.js';
import type { AuditEntry, AuditActorType } from '../domain/audit.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { AuditAction } from '../../../shared/domain/types.js';
export interface CreateAuditEntryInput {
    tenantId: TenantId;
    action: AuditAction;
    actorType: AuditActorType;
    actorEmail: string;
    resourceType: string;
    resourceId: string;
    changes?: Record<string, unknown>;
}
export declare class CreateAuditEntryUseCase {
    private readonly repo;
    constructor(repo: IAuditRepository);
    execute(input: CreateAuditEntryInput): Promise<AuditEntry>;
}

/**
 * Postgres Remediation repository implementation for the OSS runtime (AC-050).
 */
import { v4 as uuid } from 'uuid';
import type { IRemediationRepository } from '../domain/remediation.repository.js';
import type { Remediation, RemediationStep, RemediationStatus } from '../domain/remediation.entity.js';
import type { RemediationId, TenantId, IncidentId } from '../../../shared/domain/value-objects.js';
import { remediationId, incidentId } from '../../../shared/domain/value-objects.js';
import { pgGet, pgInsert, pgUpdate, pgQuery } from '../../../shared/infra/db/postgres/pg-utils.js';

const TABLE = 'remediation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDomain(row: any): Remediation {
    return {
        remediationId: remediationId(row.entity_id),
        tenantId: row.tenant_id,
        incidentId: incidentId(row.data['incidentId'] as string),
        rollbackOf: row.data['rollbackOf'] ? remediationId(row.data['rollbackOf'] as string) : undefined,
        status: row.data['status'] as RemediationStatus,
        description: row.data['description'] as string,
        rootCause: row.data['rootCause'] as string,
        steps: row.data['steps'] as RemediationStep[] ?? [],
        proposedBy: row.data['proposedBy'] as string,
        approvedBy: row.data['approvedBy'] as string | undefined,
        rejectedBy: row.data['rejectedBy'] as string | undefined,
        rejectionReason: row.data['rejectionReason'] as string | undefined,
        pullRequests: row.data['pullRequests'] as Remediation['pullRequests'],
        totalCostUsd: row.data['totalCostUsd'] as number | undefined,
        totalDurationMs: row.data['totalDurationMs'] as number | undefined,
        completedAt: row.data['completedAt'] as string | undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export class PgRemediationRepository implements IRemediationRepository {
    async create(remediation: Remediation): Promise<Remediation> {
        const data: Record<string, unknown> = {
            incidentId: remediation.incidentId,
            status: remediation.status,
            description: remediation.description,
            rootCause: remediation.rootCause,
            steps: remediation.steps,
            proposedBy: remediation.proposedBy,
            approvedBy: remediation.approvedBy,
            rejectedBy: remediation.rejectedBy,
            rejectionReason: remediation.rejectionReason,
            rollbackOf: remediation.rollbackOf,
        };
        const row = await pgInsert(TABLE, remediation.tenantId, remediation.remediationId, data);
        return toDomain(row);
    }

    async findById(tenantId: TenantId, id: RemediationId): Promise<Remediation | null> {
        const row = await pgGet(TABLE, tenantId, id);
        if (!row) return null;
        return toDomain(row);
    }

    async findByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<Remediation[]> {
        const rows = await pgQuery(
            TABLE,
            "tenant_id = $1 AND data->>'incidentId' = $2",
            [tenantId, incidentId],
            { orderBy: 'created_at DESC' },
        );
        return rows.map(toDomain);
    }

    async update(tenantId: TenantId, id: RemediationId, data: Partial<Remediation>): Promise<Remediation> {
        const updateData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) updateData[key] = value;
        }
        const row = await pgUpdate(TABLE, tenantId, id, updateData);
        return toDomain(row);
    }
}

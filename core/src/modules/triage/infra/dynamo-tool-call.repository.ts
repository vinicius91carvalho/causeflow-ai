import { toolCallId as toToolCallId } from '../../../shared/domain/value-objects.js';
import { ToolCallEntity } from '../../../shared/infra/db/entities/ToolCallEntity.js';
import type { IToolCallRepository, ToolCallLog } from '../domain/tool-call.repository.js';
import type { IncidentId, TenantId, ToolCallId } from '../../../shared/domain/value-objects.js';

function toDomain(raw: Record<string, any>): ToolCallLog {
    return {
        tenantId: raw['tenantId'],
        incidentId: raw['incidentId'],
        toolCallId: toToolCallId(raw['toolCallId']),
        agentRole: raw['agentRole'],
        name: raw['name'],
        origin: raw['origin'],
        input: raw['input'] ?? {},
        output: raw['output'] ?? '',
        success: raw['success'] ?? true,
        metadata: raw['metadata'],
        createdAt: raw['createdAt'],
    };
}

export class DynamoToolCallRepository implements IToolCallRepository {
    async create(record: ToolCallLog): Promise<ToolCallLog> {
        const result = await ToolCallEntity.create({
            tenantId: record.tenantId,
            incidentId: record.incidentId,
            toolCallId: record.toolCallId,
            agentRole: record.agentRole,
            name: record.name,
            origin: record.origin,
            input: record.input,
            output: record.output,
            success: record.success,
            metadata: record.metadata,
        }).go();
        return toDomain(result.data);
    }

    async findByIncident(tenantId: TenantId, incidentId: IncidentId): Promise<ToolCallLog[]> {
        const id = incidentId;
        const result = await ToolCallEntity.query
            .primary({ tenantId })
            .where(({ incidentId: incId }, { eq }) => eq(incId, id as string))
            .go();
        return result.data.map((item) => toDomain(item));
    }

    async findById(tenantId: TenantId, incidentId: IncidentId, toolCallId: ToolCallId): Promise<ToolCallLog | null> {
        const result = await ToolCallEntity.get({ tenantId, incidentId, toolCallId }).go();
        return result.data ? toDomain(result.data) : null;
    }
}

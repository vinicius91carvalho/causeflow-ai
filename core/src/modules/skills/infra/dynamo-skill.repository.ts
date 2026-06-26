import { Entity } from 'electrodb';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { ISkillRepository } from '../domain/skill.repository.js';
import type { InvestigationSkill, SkillId } from '../domain/skill.entity.js';
import { skillId } from '../domain/skill.entity.js';
import { config } from '../../../shared/config/index.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const SkillEntity = new Entity(
    {
        model: {
            entity: 'skill',
            version: '1',
            service: 'causeflow',
        },
        attributes: {
            tenantId: { type: 'string', required: true },
            id: { type: 'string', required: true },
            name: { type: 'string', required: true },
            displayName: { type: 'string', required: true },
            description: { type: 'string', required: true },
            whenToUse: { type: 'string', required: true },
            systemPrompt: { type: 'string', required: true },
            allowedTools: { type: 'list', items: { type: 'string' }, required: true },
            model: { type: 'string' },
            maxTurns: { type: 'number' },
            minToolCalls: { type: 'number' },
            isEnabled: { type: 'boolean', required: true, default: true },
            createdAt: { type: 'string', required: true },
            updatedAt: { type: 'string', required: true },
        },
        indexes: {
            primary: {
                pk: { field: 'pk', composite: ['tenantId'] },
                sk: { field: 'sk', composite: ['id'] },
            },
            byName: {
                index: 'gsi1',
                pk: { field: 'gsi1pk', composite: ['tenantId'] },
                sk: { field: 'gsi1sk', composite: ['name'] },
            },
        },
    },
    {
        table: config.aws.tableName,
        client: new DynamoDBClient({
            region: config.aws.region,
            ...(config.aws.dynamoEndpoint && { endpoint: config.aws.dynamoEndpoint }),
        }),
    },
);

function toDomain(item: any): InvestigationSkill {
    return {
        id: skillId(item.id),
        tenantId: item.tenantId,
        name: item.name,
        displayName: item.displayName,
        description: item.description,
        whenToUse: item.whenToUse,
        systemPrompt: item.systemPrompt,
        allowedTools: item.allowedTools,
        model: item.model,
        maxTurns: item.maxTurns,
        minToolCalls: item.minToolCalls,
        isEnabled: item.isEnabled,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
    };
}

export class DynamoSkillRepository implements ISkillRepository {
    async create(skill: InvestigationSkill): Promise<InvestigationSkill> {
        await SkillEntity.create(skill).go();
        return skill;
    }

    async findById(tenantId: TenantId, id: SkillId): Promise<InvestigationSkill | null> {
        const result = await SkillEntity.get({ tenantId, id }).go();
        return result.data ? toDomain(result.data) : null;
    }

    async findByTenant(tenantId: TenantId): Promise<InvestigationSkill[]> {
        const result = await SkillEntity.query.primary({ tenantId }).go();
        return result.data.map(toDomain);
    }

    async update(tenantId: TenantId, id: SkillId, data: Partial<InvestigationSkill>): Promise<InvestigationSkill> {
        const { id: _id, tenantId: _tid, ...updateData } = data;
        const result = await SkillEntity.update({ tenantId, id }).set(updateData as any).go({ response: 'all_new' });
        return toDomain(result.data);
    }

    async delete(tenantId: TenantId, id: SkillId): Promise<void> {
        await SkillEntity.delete({ tenantId, id }).go();
    }
}

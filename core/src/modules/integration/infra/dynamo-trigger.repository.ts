import { triggerId, tenantId } from '../../../shared/domain/value-objects.js';
import { TriggerEntity } from '../../../shared/infra/db/entities/TriggerEntity.js';
import type { Trigger } from '../domain/trigger.entity.js';
import type { ITriggerRepository } from '../domain/trigger.repository.js';
import type { TenantId, TriggerId } from '../../../shared/domain/value-objects.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDomain(raw: any) {
    return {
        triggerId: triggerId(raw['triggerId']),
        tenantId: tenantId(raw['tenantId']),
        triggerSlug: raw['triggerSlug'],
        provider: raw['provider'],
        composioTriggerId: raw['composioTriggerId'],
        connectedAccountId: raw['connectedAccountId'],
        config: raw['config'] ?? {},
        status: raw['status'],
        lastEventAt: raw['lastEventAt'],
        eventCount: raw['eventCount'] ?? 0,
        createdAt: raw['createdAt'],
        updatedAt: raw['updatedAt'],
    };
}
export class DynamoTriggerRepository {
    async create(trigger: Trigger): Promise<Trigger> {
        const result = await TriggerEntity.create({
            tenantId: String(trigger.tenantId),
            triggerId: String(trigger.triggerId),
            triggerSlug: trigger.triggerSlug,
            provider: trigger.provider,
            composioTriggerId: trigger.composioTriggerId,
            connectedAccountId: trigger.connectedAccountId,
            config: trigger.config,
            status: trigger.status,
            eventCount: trigger.eventCount,
        }).go();
        return toDomain(result.data);
    }
    async findById(tid: TenantId, trgId: TriggerId): Promise<Trigger | null> {
        const result = await TriggerEntity.get({
            tenantId: String(tid),
            triggerId: String(trgId),
        }).go();
        return result.data ? toDomain(result.data) : null;
    }
    async findByComposioTriggerId(composioTriggerId: string): Promise<Trigger | null> {
        const result = await TriggerEntity.query.byComposioTrigger({
            composioTriggerId,
        }).go();
        const first = result.data[0];
        return first ? toDomain(first) : null;
    }
    async findByTenantProviderSlug(tid: string, provider: string, slug: string): Promise<Trigger | null> {
        const compositeKey = `${tid}#${provider}#${slug}`;
        const result = await TriggerEntity.query.byTenantProviderSlug({
            tenantProviderSlug: compositeKey,
        }).go();
        const first = result.data[0];
        return first ? toDomain(first) : null;
    }
    async listByTenant(tid: TenantId): Promise<Trigger[]> {
        const result = await TriggerEntity.query.primary({
            tenantId: String(tid),
        }).go();
        return result.data.map((item) => toDomain(item));
    }
    async update(tid: TenantId, trgId: TriggerId, data: Partial<Trigger>): Promise<void> {
        const updateData: Record<string, unknown> = {};
        if (data.status !== undefined)
            updateData['status'] = data.status;
        if (data.lastEventAt !== undefined)
            updateData['lastEventAt'] = data.lastEventAt;
        if (data.eventCount !== undefined)
            updateData['eventCount'] = data.eventCount;
        if (data.config !== undefined)
            updateData['config'] = data.config;
        await TriggerEntity.patch({
            tenantId: String(tid),
            triggerId: String(trgId),
        }).set(updateData).go();
    }
    async delete(tid: TenantId, trgId: TriggerId): Promise<void> {
        await TriggerEntity.delete({
            tenantId: String(tid),
            triggerId: String(trgId),
        }).go();
    }
}

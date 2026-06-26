import type { TenantId, WidgetSessionId } from '../../../shared/domain/value-objects.js';
import { widgetSessionId } from '../../../shared/domain/value-objects.js';
import type { IWidgetSessionRepository } from '../domain/widget-session.repository.js';
import type { WidgetSession, WidgetMessage } from '../domain/widget-session.entity.js';
import type { PushSubscriptionData } from '../domain/push-subscription.types.js';
import { WidgetSessionEntity } from '../../../shared/infra/db/entities/WidgetSessionEntity.js';

function toDomain(item: any): WidgetSession {
    return {
        sessionId: widgetSessionId(item.sessionId),
        tenantId: item.tenantId,
        agentId: item.agentId,
        agentName: item.agentName,
        messages: item.messages ?? [],
        status: item.status,
        pushSubscription: item.pushSubscription,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        expiresAt: typeof item.expiresAt === 'number'
            ? new Date(item.expiresAt * 1000).toISOString()
            : item.expiresAt,
    };
}

export class DynamoWidgetSessionRepository implements IWidgetSessionRepository {
    async create(session: WidgetSession): Promise<WidgetSession> {
        const ttlSeconds = Math.floor(new Date(session.expiresAt).getTime() / 1000);
        await WidgetSessionEntity.create({
            ...session,
            expiresAt: ttlSeconds,
        }).go();
        return session;
    }

    async findById(tenantId: TenantId, sessionId: WidgetSessionId): Promise<WidgetSession | null> {
        const result = await WidgetSessionEntity.get({ tenantId, sessionId }).go();
        return result.data ? toDomain(result.data) : null;
    }

    async appendMessage(tenantId: TenantId, sessionId: WidgetSessionId, message: WidgetMessage): Promise<void> {
        const session = await this.findById(tenantId, sessionId);
        if (!session) return;

        const messages = [...session.messages, message];
        await WidgetSessionEntity.update({ tenantId, sessionId })
            .set({ messages })
            .go();
    }

    async updatePushSubscription(tenantId: TenantId, sessionId: WidgetSessionId, subscription: PushSubscriptionData): Promise<void> {
        await WidgetSessionEntity.update({ tenantId, sessionId })
            .set({ pushSubscription: subscription })
            .go();
    }

    async close(tenantId: TenantId, sessionId: WidgetSessionId): Promise<void> {
        await WidgetSessionEntity.update({ tenantId, sessionId })
            .set({ status: 'closed' })
            .go();
    }
}

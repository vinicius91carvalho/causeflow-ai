import type { TenantId, WidgetSessionId } from '../../../shared/domain/value-objects.js';
import type { WidgetSession, WidgetMessage } from './widget-session.entity.js';
import type { PushSubscriptionData } from './push-subscription.types.js';

export interface IWidgetSessionRepository {
    create(session: WidgetSession): Promise<WidgetSession>;
    findById(tenantId: TenantId, sessionId: WidgetSessionId): Promise<WidgetSession | null>;
    appendMessage(tenantId: TenantId, sessionId: WidgetSessionId, message: WidgetMessage): Promise<void>;
    updatePushSubscription(tenantId: TenantId, sessionId: WidgetSessionId, subscription: PushSubscriptionData): Promise<void>;
    close(tenantId: TenantId, sessionId: WidgetSessionId): Promise<void>;
}

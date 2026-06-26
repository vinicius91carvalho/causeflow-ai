import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { WidgetSessionId } from '../../../shared/domain/value-objects.js';
import type { ChatIntent } from '../../memory/application/chat.usecase.js';
import type { PushSubscriptionData } from './push-subscription.types.js';

export type WidgetSessionStatus = 'active' | 'closed';

export interface WidgetMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    chatId?: string;
    intent?: ChatIntent;
    incidentId?: string;
    followUpQuestions?: string[];
}

export interface WidgetSession {
    sessionId: WidgetSessionId;
    tenantId: TenantId;
    agentId?: string;
    agentName?: string;
    messages: WidgetMessage[];
    status: WidgetSessionStatus;
    pushSubscription?: PushSubscriptionData;
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
}

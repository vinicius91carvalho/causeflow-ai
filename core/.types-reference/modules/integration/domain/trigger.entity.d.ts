import type { TenantId, TriggerId } from '../../../shared/domain/value-objects.js';
export type TriggerStatus = 'active' | 'paused' | 'error';
export interface Trigger {
    triggerId: TriggerId;
    tenantId: TenantId;
    triggerSlug: string;
    provider: string;
    composioTriggerId: string;
    connectedAccountId: string;
    config: Record<string, unknown>;
    status: TriggerStatus;
    lastEventAt?: string;
    eventCount: number;
    createdAt: string;
    updatedAt: string;
}

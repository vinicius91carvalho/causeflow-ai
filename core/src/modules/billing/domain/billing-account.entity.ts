import type { TenantId } from '../../../shared/domain/value-objects.js';

/**
 * Local usage counter for quota enforcement.
 *
 * Limits are synced from Stripe (via webhooks) and cached here for atomic
 * DynamoDB conditional increments. Usage counters are the authoritative
 * local state; Stripe meters track the same usage for billing purposes.
 */
export interface BillingAccount {
    tenantId: TenantId;
    investigationsLimit: number;
    investigationsUsed: number;
    eventsLimit: number;
    eventsUsed: number;
    createdAt: string;
    updatedAt: string;
}

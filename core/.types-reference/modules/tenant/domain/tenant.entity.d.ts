import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { TenantPlan, TenantStatus } from '../../../shared/domain/types.js';
export interface TenantSettings {
    maxIncidentsPerMonth: number;
    autoRemediation: boolean;
    notificationChannels: string[];
    awsRoleArn?: string;
    awsExternalId?: string;
    awsRegion?: string;
    chatProvider?: 'web_portal' | 'slack' | 'teams';
}
export type SubscriptionStatus = 'active' | 'past_due' | 'canceling' | 'canceled';
export type TeamSize = '1_5' | '6_20' | '21_50' | '50plus';
export interface Tenant {
    tenantId: TenantId;
    name: string;
    slug: string;
    ownerEmail: string;
    plan: TenantPlan;
    status: TenantStatus;
    settings: TenantSettings;
    creditsTotal: number;
    creditsUsed: number;
    renewDate?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: SubscriptionStatus;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    websiteUrl?: string;
    teamSize?: TeamSize;
    createdAt: string;
    updatedAt: string;
}
export declare const DEFAULT_TENANT_SETTINGS: TenantSettings;

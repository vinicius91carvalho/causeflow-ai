import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { TenantPlan, TenantStatus } from '../../../shared/domain/types.js';
import type { DataMaskingConfig } from '../../widget/domain/data-masking.types.js';

export interface SlackConfig {
    webhookUrl: string;
    channel: string;
    channelId: string;
    workspaceId: string;
    workspaceName: string;
    accessToken: string;
    installedAt: string;
    configurationUrl?: string;
}

export interface SlackConfigResponse {
    connected: boolean;
    channel?: string;
    workspaceName?: string;
    installedAt?: string;
}

export interface SlackConfigUpdateInput {
    channel: string;
}

export interface TenantSettings {
    maxIncidentsPerMonth: number;
    autoRemediation: boolean;
    notificationChannels: string[];
    chatProvider?: 'web_portal' | 'slack' | 'teams';
    widgetConfig?: WidgetConfig;
    slackConfig?: SlackConfig;
}

export interface WidgetBranding {
    primaryColor?: string;
    logoUrl?: string;
    headerText?: string;
    welcomeMessage?: string;
}

export interface WidgetConfig {
    enabled: boolean;
    allowedOrigins: string[];
    customDomain?: string;
    branding: WidgetBranding;
    dataMasking: DataMaskingConfig;
    rateLimit?: number;
    maxSessionMessages?: number;
}

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceling' | 'canceled';

export type TeamSize = '1_5' | '6_20' | '21_50' | '50plus';

export interface Tenant {
    tenantId: TenantId;
    name: string;
    slug: string;
    ownerEmail: string;
    plan: TenantPlan;
    status: TenantStatus;
    settings: TenantSettings;
    renewDate?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: SubscriptionStatus;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    websiteUrl?: string;
    teamSize?: TeamSize;
    customDomain?: string;
    createdAt: string;
    updatedAt: string;
}

export const DEFAULT_TENANT_SETTINGS = {
    maxIncidentsPerMonth: 50,
    autoRemediation: false,
    notificationChannels: [],
};

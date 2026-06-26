import type { TenantId } from '../../../shared/domain/value-objects.js';
export type Theme = 'light' | 'dark' | 'system';
export type Locale = 'en' | 'pt-br';
export interface NotificationPreferences {
    emailOnComplete: boolean;
    emailOnError: boolean;
    slackOnComplete: boolean;
    slackOnError: boolean;
}
export interface UserSettings {
    tenantId: TenantId;
    userId: string;
    theme: Theme;
    locale: Locale;
    notifications: NotificationPreferences;
    createdAt: string;
    updatedAt: string;
}
export declare const DEFAULT_SETTINGS: Omit<UserSettings, 'tenantId' | 'userId' | 'createdAt' | 'updatedAt'>;

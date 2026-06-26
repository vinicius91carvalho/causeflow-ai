/**
 * Settings domain types.
 */

export type Theme = 'light' | 'dark' | 'system';

/**
 * Canonical locale union — must be exactly `'en' | 'pt-br'`, no wider no narrower.
 * Downstream sprints import this type; do NOT widen to `string`.
 */
export type Locale = 'en' | 'pt-br';

export interface NotificationSettings {
  emailOnComplete: boolean;
  emailOnError: boolean;
  slackOnComplete: boolean;
  slackOnError: boolean;
}

/**
 * User-level settings returned by Core's GET /v1/users/:userId/settings.
 * Mirrors the UserSettingsEntity schema (ElectroDB, table causeflow-<stage>).
 */
export interface UserSettings {
  theme: Theme;
  locale: Locale;
  notifications: NotificationSettings;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  tenantId: string;
  notifications: NotificationSettings;
  locale: Locale;
  theme: Theme;
}

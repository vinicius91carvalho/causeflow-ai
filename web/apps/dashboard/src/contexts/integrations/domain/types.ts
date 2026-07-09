/**
 * Integrations domain types.
 */

export type IntegrationType =
  | 'slack'
  | 'github'
  | 'jira'
  | 'cloudwatch'
  | 'hubspot'
  | 'trello'
  | 'postgresql'
  | 'linear'
  | 'sentry'
  | 'mongodb'
  | 'datadog'
  | 'pagerduty'
  | 'grafana'
  | 'confluence'
  | 'webhooks';

/** Human-readable display names for all integration types. */
export const INTEGRATION_DISPLAY_NAMES: Record<string, string> = {
  slack: 'Slack',
  github: 'GitHub',
  jira: 'Jira',
  cloudwatch: 'AWS',
  hubspot: 'HubSpot',
  trello: 'Trello',
  postgresql: 'PostgreSQL',
  linear: 'Linear',
  sentry: 'Sentry',
  mongodb: 'MongoDB',
  datadog: 'Datadog',
  pagerduty: 'PagerDuty',
  grafana: 'Grafana',
  confluence: 'Confluence',
  webhooks: 'Custom Webhooks',
};

export type IntegrationAuthType = 'credentials' | 'oauth';

/**
 * Maps each integration type to its authentication method.
 */
export const INTEGRATION_AUTH_TYPES: Record<IntegrationType, IntegrationAuthType> = {
  cloudwatch: 'credentials',
  slack: 'oauth',
  jira: 'oauth',
  trello: 'oauth',
  github: 'oauth',
  hubspot: 'oauth',
  sentry: 'oauth',
  postgresql: 'credentials',
  linear: 'oauth',
  mongodb: 'credentials',
  datadog: 'oauth',
  pagerduty: 'oauth',
  grafana: 'credentials',
  confluence: 'oauth',
  webhooks: 'credentials',
};

/** i18n keys for OAuth button labels, resolved via `t()` in the connection modal. */
export const OAUTH_BUTTON_I18N_KEYS: Partial<Record<IntegrationType, string>> = {
  slack: 'oauthButton.slack',
};

export interface ActiveTrigger {
  triggerId: string;
  triggerSlug: string;
  provider: string;
  status: 'active' | 'paused';
  eventCount?: number;
  createdAt: string;
}

export interface TriggerDto {
  triggerId: string;
  triggerSlug: string;
  provider: string;
  status: string;
  connectedAccountId: string;
  eventCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTriggerInput {
  provider: string;
  triggerSlug: string;
  config?: Record<string, unknown>;
}

export type IntegrationStatus = 'connected' | 'disconnected' | 'error';

export interface Integration {
  tenantId: string;
  type: IntegrationType;
  name: string;
  status: IntegrationStatus;
  /** KMS-encrypted JSON blob of provider credentials */
  encryptedCredentials?: string;
  lastTestedAt?: string;
  connectedBy?: string;
  createdAt: string;
}

/** A single Sentry trigger subscription known to the backend. */
export interface SentryTrigger {
  type: string;
}

/**
 * Status payload for the Sentry Internal Integration.
 *
 * - `hasClientSecret`: true once the user has saved a Client Secret on the
 *   dashboard (the secret itself is never returned to the client).
 * - `verified` / `verifiedAt`: flipped on the first valid HMAC-signed webhook
 *   hit. Until then, the card shows "Awaiting first event from Sentry".
 * - `lastEventAt`: updated on every valid hit. Used to render
 *   "Verified — last event {relative time}".
 * - `triggers`: list of webhook trigger types the backend currently has
 *   subscriptions for. May be `[]` per Sprint 1's GET implementation.
 */
export interface SentryIntegrationStatus {
  hasClientSecret: boolean;
  verified: boolean;
  verifiedAt: string | null;
  lastEventAt: string | null;
  triggers: SentryTrigger[];
}

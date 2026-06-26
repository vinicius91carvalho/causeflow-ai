import { Composio } from '@composio/core';
import { config } from '../../config/index.js';
import { instrumentedCall } from '../observability/outbound.js';
let _client: Composio | null = null;
/**
 * Singleton Composio client (v3 SDK).
 * Returns null if COMPOSIO_API_KEY is not configured.
 */
export function getComposioClient(): Composio | null {
    if (_client)
        return _client;
    const apiKey = config.composio?.apiKey;
    if (!apiKey)
        return null;
    _client = new Composio({ apiKey });
    return _client;
}
/**
 * Mapping of CauseFlow integration types to Composio app names.
 */
export const COMPOSIO_APP_MAP = {
    // Communication
    slack: 'slack',
    teams: 'microsoft-teams',
    discord: 'discord',
    // Code
    github: 'github',
    gitlab: 'gitlab',
    bitbucket: 'bitbucket',
    // Project Management
    jira: 'jira',
    linear: 'linear',
    trello: 'trello',
    shortcut: 'shortcut',
    clickup: 'clickup',
    asana: 'asana',
    // Monitoring & Observability
    datadog: 'datadog',
    sentry: 'sentry',
    pagerduty: 'pagerduty',
    newrelic: 'new_relic',
    // Knowledge
    notion: 'notion',
    confluence: 'confluence',
    // CRM & Support
    hubspot: 'hubspot',
    zendesk: 'zendesk',
    intercom: 'intercom',
};
/**
 * Providers managed by Composio (OAuth + actions).
 */
export const COMPOSIO_PROVIDERS = new Set(Object.keys(COMPOSIO_APP_MAP));
/**
 * Providers handled by our own infra (IAM roles, connection strings, API keys).
 */
export const DIY_PROVIDERS = new Set([
    'cloudwatch',
    'postgresql',
    'mongodb',
    'grafana',
    'webhooks',
]);

/**
 * Instrumented wrapper for Composio SDK action execution.
 * Use this instead of calling composio SDK methods directly.
 */
export async function executeComposioAction<T>(
  op: string,
  fn: () => Promise<T>,
  attrs?: Record<string, unknown>,
): Promise<T> {
  return instrumentedCall('composio', op, fn, { attributes: attrs });
}

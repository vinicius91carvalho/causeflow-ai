import { config } from '../../config/index.js';
import { instrumentedCall } from '../observability/outbound.js';

let _client: any = null;
let _ComposioClass: any = null;

/**
 * Lazy reference to the Composio SDK. Only populated when COMPOSIO_API_KEY is set.
 * This ensures @composio/core is never loaded at module level when Composio is
 * not configured (AC-049).
 */
async function getComposioSdk(): Promise<any> {
  if (_ComposioClass !== null) return _ComposioClass;
  if (!config.composio?.apiKey) return null;
  const { Composio } = await import('@composio/core');
  _ComposioClass = Composio;
  return _ComposioClass;
}

/**
 * Singleton Composio client (v3 SDK).
 * Returns null if COMPOSIO_API_KEY is not configured.
 * The @composio/core module is NOT loaded at module level — it is imported
 * lazily only when COMPOSIO_API_KEY is set (AC-049).
 */
export async function getComposioClient(): Promise<any> {
  if (_client) return _client;
  const apiKey = config.composio?.apiKey;
  if (!apiKey) return null;
  const Composio = await getComposioSdk();
  if (!Composio) return null;
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
 * Use this instead of calling Composio SDK methods directly.
 */
export async function executeComposioAction<T>(
  op: string,
  fn: () => Promise<T>,
  attrs?: Record<string, unknown>,
): Promise<T> {
  return instrumentedCall('composio', op, fn, { attributes: attrs });
}

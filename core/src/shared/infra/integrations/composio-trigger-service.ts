import { getComposioClient, COMPOSIO_APP_MAP } from './composio-client.js';
import { config } from '../../config/index.js';
import { logger } from '../logger.js';

export interface ComposioTriggerResult {
  composioTriggerId: string;
  connectedAccountId: string;
}

export interface AvailableTrigger {
  slug: string;
  app: string;
  description: string;
}

/**
 * Incident-relevant trigger catalog. Only slugs handled by TriggerEventMapper are listed.
 *
 * Webhook-only providers (sentry, pagerduty, datadog) have no Composio trigger types —
 * they receive events via CauseFlow's direct webhook endpoint (/v1/webhooks/:tenantId/:provider).
 * GitHub uses Composio trigger instances (46 trigger types available).
 *
 * Excluded intentionally:
 * - slack: on /settings (not /integrations); fires on ALL messages (too noisy)
 * - jira/linear/notion/discord/zendesk: not mapped to incidents in TriggerEventMapper
 */
const TRIGGER_CATALOG: Record<string, AvailableTrigger[]> = {
  github: [
    { slug: 'GITHUB_COMMIT_EVENT', app: 'github', description: 'New commit or push event' },
    {
      slug: 'GITHUB_PULL_REQUEST_EVENT',
      app: 'github',
      description: 'Pull request opened, merged, or closed',
    },
  ],
  sentry: [{ slug: 'SENTRY_NEW_ISSUE', app: 'sentry', description: 'New issue detected' }],
  pagerduty: [
    { slug: 'PAGERDUTY_INCIDENT_TRIGGERED', app: 'pagerduty', description: 'Incident triggered' },
  ],
  datadog: [
    { slug: 'DATADOG_MONITOR_TRIGGERED', app: 'datadog', description: 'Monitor alert triggered' },
  ],
};

/**
 * Providers that deliver events via CauseFlow's own webhook endpoint rather than Composio triggers.
 * For these, createTrigger skips Composio and returns a direct webhook URL instead.
 */
const WEBHOOK_ONLY_PROVIDERS = new Set(['sentry', 'pagerduty', 'datadog']);

/** Cache enriched descriptions from Composio API. */
let enrichedCache: Record<string, AvailableTrigger[]> | null = null;

async function getEnrichedCatalog(): Promise<Record<string, AvailableTrigger[]>> {
  if (enrichedCache) return enrichedCache;
  const apiKey = config.composio?.apiKey;
  if (!apiKey) return TRIGGER_CATALOG;
  try {
    const appNames = Object.values(COMPOSIO_APP_MAP).join(',');
    const res = await fetch(`https://backend.composio.dev/api/v1/triggers?appNames=${appNames}`, {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return TRIGGER_CATALOG;
    const data = (await res.json()) as Record<string, unknown>;
    const items = (data.items ?? data) as Array<Record<string, unknown>>;
    // Build slug → description map from Composio
    const descMap = new Map<string, string>();
    for (const t of Array.isArray(items) ? items : []) {
      const slug = (t.enum ?? t.slug ?? '') as string;
      const desc = ((t.description ?? '') as string).replace(/^Trigger for\s+/i, '');
      if (slug && desc) descMap.set(slug, desc);
    }
    // Enrich our curated catalog with Composio descriptions
    const enriched: Record<string, AvailableTrigger[]> = {};
    for (const [provider, triggers] of Object.entries(TRIGGER_CATALOG)) {
      enriched[provider] = triggers.map((t) => ({
        ...t,
        description: descMap.get(t.slug) ?? t.description,
      }));
    }
    enrichedCache = enriched;
    return enriched;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : err },
      'Failed to enrich trigger catalog from Composio',
    );
    return TRIGGER_CATALOG;
  }
}
export class ComposioTriggerService {
  baseUrl = 'https://backend.composio.dev/api/v3';
  async registerWebhookSubscription(
    webhookUrl: string,
  ): Promise<{ registered: boolean; url: string }> {
    const apiKey = config.composio.apiKey;
    if (!apiKey) throw new Error('Composio API key not configured');

    // GET existing subscriptions first — avoid duplicate registrations
    try {
      const getRes = await fetch(`${this.baseUrl}/webhook_subscriptions`, {
        headers: { 'X-API-KEY': apiKey },
        signal: AbortSignal.timeout(15_000),
      });
      if (getRes.ok) {
        const data = (await getRes.json()) as { items?: Array<{ webhook_url?: string }> };
        const items =
          data.items ?? (Array.isArray(data) ? (data as Array<{ webhook_url?: string }>) : []);
        const alreadyRegistered = items.some((s) => s.webhook_url === webhookUrl);
        if (alreadyRegistered) {
          return { registered: false, url: webhookUrl }; // false = already existed
        }
      }
    } catch {
      // If GET fails, attempt POST anyway
    }

    const res = await fetch(`${this.baseUrl}/webhook_subscriptions`, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhook_url: webhookUrl,
        enabled_events: ['composio.trigger.message'],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to register webhook subscription: ${res.status} ${text}`);
    }
    return { registered: true, url: webhookUrl };
  }
  async createTrigger(
    connectedAccountId: string,
    triggerSlug: string,
    triggerConfig: Record<string, unknown>,
    provider?: string,
  ): Promise<ComposioTriggerResult> {
    // Webhook-only providers (sentry, pagerduty, datadog) have no Composio trigger types.
    // Events arrive via CauseFlow's direct webhook endpoint instead.
    const resolvedProvider = provider ?? triggerSlug.split('_')[0]?.toLowerCase() ?? '';
    if (WEBHOOK_ONLY_PROVIDERS.has(resolvedProvider)) {
      return { composioTriggerId: '', connectedAccountId };
    }
    // GitHub and other Composio-backed providers: POST /api/v3/trigger_instances/{slug}/upsert
    const apiKey = config.composio.apiKey;
    if (!apiKey) throw new Error('Composio API key not configured');
    const res = await fetch(
      `${this.baseUrl}/trigger_instances/${encodeURIComponent(triggerSlug)}/upsert`,
      {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connected_account_id: connectedAccountId,
          trigger_config: triggerConfig,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to create trigger: ${res.status} ${text}`);
    }
    const data = (await res.json()) as { trigger_id: string };
    return {
      composioTriggerId: data.trigger_id ?? '',
      connectedAccountId,
    };
  }
  async deleteTrigger(composioTriggerId: string): Promise<void> {
    // Webhook-only providers (sentry, pagerduty, datadog) have no Composio trigger to delete
    if (!composioTriggerId) return;
    const client = await getComposioClient();
    if (client) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const triggers = client.triggers;
        if (triggers?.delete) {
          await triggers.delete(composioTriggerId);
          return;
        }
      } catch {
        // Fall through to HTTP
      }
    }
    const apiKey = config.composio.apiKey;
    if (!apiKey) return;
    const res = await fetch(`${this.baseUrl}/triggers/${composioTriggerId}`, {
      method: 'DELETE',
      headers: { 'X-API-KEY': apiKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      throw new Error(`Failed to delete trigger: ${res.status} ${text}`);
    }
  }
  async listAvailableTriggers(): Promise<Record<string, AvailableTrigger[]>> {
    return getEnrichedCatalog();
  }
  async getTriggersForProvider(provider: string): Promise<AvailableTrigger[]> {
    const catalog = await getEnrichedCatalog();
    return catalog[provider] ?? [];
  }
  getComposioApp(provider: string): string | undefined {
    return (COMPOSIO_APP_MAP as Record<string, string>)[provider];
  }
}

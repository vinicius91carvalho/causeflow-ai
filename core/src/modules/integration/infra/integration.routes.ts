import { Hono } from 'hono';
import { requireRole } from '../../../shared/infra/http/middleware/rbac.middleware.js';
import { tenantId } from '../../../shared/domain/value-objects.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { config } from '../../../shared/config/index.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { ConnectCredentialUseCase } from '../application/connect-credential.usecase.js';
import type { DisconnectIntegrationUseCase } from '../application/disconnect-integration.usecase.js';
import type { ListAllIntegrationsUseCase } from '../application/list-all-integrations.usecase.js';
import type { GetCloudIntegrationUseCase } from '../application/get-cloud-integration.usecase.js';
import type { FinalizeConnectionUseCase } from '../application/finalize-connection.usecase.js';
import type { IntegrationToolProvider } from '../../../shared/application/ports/integration-tool-provider.port.js';
import {
  COMPOSIO_APP_MAP,
  COMPOSIO_PROVIDERS,
} from '../../../shared/infra/integrations/composio-client.js';
import { logger } from '../../../shared/infra/logger.js';
import type { SlackRouteDeps } from './slack.routes.js';
import { createSlackRoutes } from './slack.routes.js';
import type { SaveSentryClientSecretUseCase } from '../application/save-sentry-client-secret.usecase.js';
import type { GetSentryIntegrationStatusUseCase } from '../application/get-sentry-integration-status.usecase.js';
import type { ComposioRouteDeps } from './trigger.routes.js';
import { createComposioRoutes } from './trigger.routes.js';
import type { StubIntegrationRouteDeps } from './stub-integration.routes.js';
import { createStubIntegrationRoutes } from './stub-integration.routes.js';

export interface IntegrationUseCases {
  connectCredential: ConnectCredentialUseCase;
  disconnectIntegration: DisconnectIntegrationUseCase;
  listAllIntegrations: ListAllIntegrationsUseCase;
  getCloudIntegration?: GetCloudIntegrationUseCase;
  composioToolProvider?: IntegrationToolProvider;
  slackDeps?: SlackRouteDeps;
  finalizeConnection?: Pick<FinalizeConnectionUseCase, 'execute'>;
  saveSentryClientSecret?: SaveSentryClientSecretUseCase;
  getSentryIntegrationStatus?: GetSentryIntegrationStatusUseCase;
  composioRouteDeps?: ComposioRouteDeps;
  stubRouteDeps?: StubIntegrationRouteDeps;
}

/** Static metadata for our supported providers (category + type). Composio enriches with description/logo. */
const PROVIDER_META: Record<string, { category: string; type: 'oauth' | 'credential' }> = {
  aws: { category: 'cloud', type: 'credential' },
  github: { category: 'code', type: 'oauth' },
  gitlab: { category: 'code', type: 'oauth' },
  bitbucket: { category: 'code', type: 'oauth' },
  slack: { category: 'communication', type: 'oauth' },
  teams: { category: 'communication', type: 'oauth' },
  discord: { category: 'communication', type: 'oauth' },
  jira: { category: 'project', type: 'oauth' },
  linear: { category: 'project', type: 'oauth' },
  trello: { category: 'project', type: 'oauth' },
  shortcut: { category: 'project', type: 'oauth' },
  clickup: { category: 'project', type: 'oauth' },
  asana: { category: 'project', type: 'oauth' },
  datadog: { category: 'monitoring', type: 'oauth' },
  sentry: { category: 'monitoring', type: 'oauth' },
  pagerduty: { category: 'monitoring', type: 'oauth' },
  newrelic: { category: 'monitoring', type: 'oauth' },
  notion: { category: 'knowledge', type: 'oauth' },
  confluence: { category: 'knowledge', type: 'oauth' },
  hubspot: { category: 'crm', type: 'oauth' },
  zendesk: { category: 'crm', type: 'oauth' },
  intercom: { category: 'crm', type: 'oauth' },
};

/** Cache Composio app metadata (fetched once, refreshed on error). */
let composioAppsCache: Map<
  string,
  { name: string; description: string; logo: string; categories: string[] }
> | null = null;

async function getComposioApps(): Promise<typeof composioAppsCache> {
  if (composioAppsCache) return composioAppsCache;
  const apiKey = config.composio?.apiKey;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://backend.composio.dev/api/v1/apps', {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Composio API ${res.status}`);
    const data = (await res.json()) as { items?: Array<Record<string, unknown>> };
    const items = (data.items ?? data) as Array<Record<string, unknown>>;
    const map = new Map<
      string,
      { name: string; description: string; logo: string; categories: string[] }
    >();
    for (const app of items) {
      const key = (app.key ?? '') as string;
      if (key) {
        map.set(key, {
          name: (app.name ?? key) as string,
          description: (app.description ?? '') as string,
          logo: (app.logo ?? `https://logos.composio.dev/api/${key}`) as string,
          categories: (app.categories ?? []) as string[],
        });
      }
    }
    composioAppsCache = map;
    return map;
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : err },
      'Failed to fetch Composio apps catalog',
    );
    return null;
  }
}

const DISPLAY_NAMES: Record<string, string> = {
  aws: 'Amazon Web Services',
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  slack: 'Slack',
  teams: 'Microsoft Teams',
  discord: 'Discord',
  jira: 'Jira',
  linear: 'Linear',
  trello: 'Trello',
  shortcut: 'Shortcut',
  clickup: 'ClickUp',
  asana: 'Asana',
  datadog: 'Datadog',
  sentry: 'Sentry',
  pagerduty: 'PagerDuty',
  newrelic: 'New Relic',
  notion: 'Notion',
  confluence: 'Confluence',
  hubspot: 'HubSpot',
  zendesk: 'Zendesk',
  intercom: 'Intercom',
};

export function createIntegrationRoutes(useCases: IntegrationUseCases) {
  const app = new Hono<AppEnv>();

  // Mount Slack sub-router at /slack (full path: /v1/integrations/slack)
  if (useCases.slackDeps) {
    app.route('/slack', createSlackRoutes(useCases.slackDeps));
  }

  // Mount Composio sub-router at /composio (full path: /v1/integrations/composio/*)
  // AC-031: GET /v1/integrations/composio/tools, POST /v1/integrations/composio/triggers
  if (useCases.composioRouteDeps) {
    app.route('/composio', createComposioRoutes(useCases.composioRouteDeps));
  }

  // OSS stub upstream connector (AC-056): /v1/integrations/stub/*
  if (useCases.stubRouteDeps) {
    app.route('/stub', createStubIntegrationRoutes(useCases.stubRouteDeps));
  }

  // GET /catalog — list all available integration providers with Composio metadata
  app.get('/catalog', async (c) => {
    const tid = c.get('tenantId')!;
    const composioApps = await getComposioApps();

    const providers = Object.entries(PROVIDER_META).map(([id, meta]) => {
      // Composio key for this provider
      const composioKey = COMPOSIO_APP_MAP[id as keyof typeof COMPOSIO_APP_MAP];
      const composioMeta = composioApps?.get(composioKey ?? '');

      const displayName = DISPLAY_NAMES[id] ?? composioMeta?.name ?? id;

      const provider: Record<string, unknown> = {
        id,
        name: displayName,
        category: meta.category,
        type: meta.type,
        description:
          id === 'aws'
            ? 'CloudWatch logs & metrics, ECS, EC2, Lambda, RDS, S3 — read-only access via IAM AssumeRole'
            : id === 'teams'
              ? 'Receive incident notifications and updates in Microsoft Teams channels'
              : (composioMeta?.description ?? ''),
        logo: composioMeta?.logo ?? `https://logos.composio.dev/api/${composioKey ?? id}`,
      };

      if (id === 'aws') {
        const accountId = config.sts.accountId;
        if (accountId) {
          provider.setup = {
            accountId,
            externalId: String(tid),
            trustPolicyPrincipal: `arn:aws:iam::${accountId}:root`,
          };
        }
      }

      return provider;
    });

    return c.json({ providers });
  });

  // POST /credentials — connect a credential-based integration (admin only)
  app.post('/credentials', requireRole('admin'), async (c) => {
    const tid = c.get('tenantId')!;
    const body = await c.req.json();
    if (!body.provider || typeof body.provider !== 'string') {
      throw new ValidationError('provider is required');
    }
    if (
      !body.credentials ||
      typeof body.credentials !== 'object' ||
      Object.keys(body.credentials).length === 0
    ) {
      throw new ValidationError('credentials object is required and must not be empty');
    }
    if (body.provider === 'aws') {
      const { roleArn } = body.credentials;
      if (!roleArn) {
        throw new ValidationError('roleArn is required for AWS integration');
      }
    }
    const result = await useCases.connectCredential.execute({
      tenantId: tenantId(String(tid)),
      provider: body.provider,
      credentials: body.credentials,
      connectedBy: c.get('userId'),
    });
    return c.json(result, 201);
  });

  // DELETE /credentials/:type — disconnect a credential-based integration (admin only)
  app.delete('/credentials/:type', requireRole('admin'), async (c) => {
    const tid = c.get('tenantId')!;
    const provider = c.req.param('type');
    const result = await useCases.disconnectIntegration.execute({
      tenantId: tenantId(String(tid)),
      provider,
    });
    return c.json(result);
  });

  // POST /test-connection — test AWS AssumeRole.
  // Uses roleArn from body (during initial connect flow) or falls back to the saved Integration entity (re-test after connection).
  app.post('/test-connection', requireRole('admin'), async (c) => {
    const tid = c.get('tenantId')!;
    const body = await c.req.json();
    if (body.type !== 'cloudwatch' && body.type !== 'aws') {
      return c.json({ success: true, message: 'Format validation passed' });
    }
    let roleArn: string | undefined = body.roleArn;
    if (!roleArn && useCases.getCloudIntegration) {
      const saved = await useCases.getCloudIntegration.execute(tenantId(String(tid)));
      roleArn = saved?.roleArn;
    }
    if (!roleArn) {
      return c.json({
        success: false,
        message: 'No AWS integration found for this tenant. Connect AWS first.',
      });
    }
    try {
      const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts');
      const stsClient = new STSClient({
        region: config.aws.region,
        ...(config.sts.stsEndpoint && { endpoint: config.sts.stsEndpoint }),
      });
      await stsClient.send(
        new AssumeRoleCommand({
          RoleArn: roleArn,
          RoleSessionName: 'causeflow-test-connection',
          ExternalId: String(tid),
          DurationSeconds: 900,
        }),
      );
      return c.json({
        success: true,
        message: 'Connection successful. CauseFlow can access your AWS account.',
      });
    } catch (err) {
      const errName = err instanceof Error ? err.name : 'Unknown';
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.warn(
        { err: msg, errName, tenantId: String(tid), roleArn },
        'test-connection AssumeRole failed',
      );
      return c.json({
        success: false,
        message: `Connection failed: ${errName === 'AccessDenied' ? 'AccessDenied — check the role trust policy includes ExternalId=' + String(tid) : msg}`,
      });
    }
  });

  // POST /connect — initiate OAuth connection via Composio
  app.post('/connect', requireRole('admin'), async (c) => {
    const tid = c.get('tenantId')!;
    if (!useCases.composioToolProvider) {
      return c.json({ error: 'Composio not configured' }, 503);
    }
    const body = await c.req.json();
    if (!body.provider || typeof body.provider !== 'string') {
      throw new ValidationError('provider is required');
    }
    if (!COMPOSIO_PROVIDERS.has(body.provider)) {
      throw new ValidationError(
        `Unsupported provider: ${body.provider}. Supported: ${[...COMPOSIO_PROVIDERS].join(', ')}`,
      );
    }
    if (!body.redirectUrl || typeof body.redirectUrl !== 'string') {
      throw new ValidationError('redirectUrl is required');
    }
    const authUrl = await useCases.composioToolProvider.initiateAuth(
      String(tid),
      body.provider,
      body.redirectUrl,
    );
    return c.json({ authUrl });
  });

  // POST /connect/:provider/finalize — finalize Composio OAuth connection
  app.post('/connect/:provider/finalize', requireRole('admin'), async (c) => {
    const tid = c.get('tenantId')!;
    const userId = c.get('userId')!;
    const provider = c.req.param('provider');
    if (!useCases.finalizeConnection) {
      return c.json({ error: 'Integration finalize not configured' }, 503);
    }
    const body = (await c.req.json()) as { connectedAccountId?: string };
    if (!body.connectedAccountId || typeof body.connectedAccountId !== 'string') {
      return c.json({ code: 'missing_connected_account_id' }, 400);
    }
    const result = await useCases.finalizeConnection.execute({
      tenantId: tenantId(String(tid)),
      provider,
      connectedAccountId: body.connectedAccountId,
      connectedBy: String(userId),
    });
    return c.json(result);
  });

  // DELETE /connect/:provider — revoke a Composio connection
  app.delete('/connect/:provider', requireRole('admin'), async (c) => {
    const tid = c.get('tenantId')!;
    if (!useCases.composioToolProvider) {
      return c.json({ error: 'Composio not configured' }, 503);
    }
    const provider = c.req.param('provider');
    await useCases.composioToolProvider.revokeConnection(String(tid), provider);
    return c.json({ success: true });
  });

  // POST /sentry — save (or rotate) Sentry Client Secret (admin only)
  app.post('/sentry', requireRole('admin'), async (c) => {
    if (!useCases.saveSentryClientSecret) {
      return c.json({ error: 'Sentry integration not configured' }, 503);
    }
    const tid = c.get('tenantId')!;
    const body = (await c.req.json()) as { clientSecret?: unknown };
    if (!body.clientSecret || typeof body.clientSecret !== 'string') {
      throw new ValidationError('clientSecret is required');
    }
    const result = await useCases.saveSentryClientSecret.execute({
      tenantId: tenantId(String(tid)),
      clientSecret: body.clientSecret,
    });
    return c.json(result, 201);
  });

  // GET /sentry — get Sentry integration status (no credentials returned)
  app.get('/sentry', async (c) => {
    if (!useCases.getSentryIntegrationStatus) {
      return c.json({ error: 'Sentry integration not configured' }, 503);
    }
    const tid = c.get('tenantId')!;
    const status = await useCases.getSentryIntegrationStatus.execute(tenantId(String(tid)));
    // Map domain field `configured` → API field `hasClientSecret` so the dashboard
    // receives the expected shape. The domain uses `configured` internally; the HTTP
    // contract exposes `hasClientSecret` for clarity at the API boundary.
    return c.json({
      hasClientSecret: status.configured,
      verified: status.verified,
      verifiedAt: status.verifiedAt,
      lastEventAt: status.lastEventAt,
    });
  });

  // GET / — unified list of all integrations (credential-based + Composio)
  app.get('/', async (c) => {
    const tid = c.get('tenantId')!;
    const integrations = await useCases.listAllIntegrations.execute(tenantId(String(tid)));
    let composioConnections: Array<{ provider: string; status: string; createdAt?: string }> = [];
    if (useCases.composioToolProvider) {
      composioConnections = await useCases.composioToolProvider.getConnectionStatus(String(tid));
    }
    // Deduplicate Composio connections: keep best per provider (connected > disconnected > error)
    const STATUS_PRIORITY: Record<string, number> = { connected: 3, disconnected: 2, error: 1 };
    const bestByProvider = new Map<
      string,
      { provider: string; status: string; createdAt?: string }
    >();
    for (const cc of composioConnections) {
      if (!cc.provider || cc.provider.trim() === '') continue;
      const existing = bestByProvider.get(cc.provider);
      if (
        !existing ||
        (STATUS_PRIORITY[cc.status] ?? 0) > (STATUS_PRIORITY[existing.status] ?? 0)
      ) {
        bestByProvider.set(cc.provider, cc);
      }
    }
    const existingProviders = new Set(integrations.map((i) => i.provider));
    const composioOnly = [...bestByProvider.values()]
      .filter((cc) => !existingProviders.has(cc.provider))
      .map((cc) => ({
        type: cc.provider,
        provider: cc.provider,
        name:
          DISPLAY_NAMES[cc.provider] ?? cc.provider.charAt(0).toUpperCase() + cc.provider.slice(1),
        status: cc.status,
        source: 'composio',
        createdAt: cc.createdAt,
      }));
    return c.json({ integrations: [...integrations, ...composioOnly] });
  });

  return app;
}

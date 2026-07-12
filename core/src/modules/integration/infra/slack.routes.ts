import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { WebClient } from '@slack/web-api';
import { requireRole } from '../../../shared/infra/http/middleware/rbac.middleware.js';
import { tenantId } from '../../../shared/domain/value-objects.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { logger } from '../../../shared/infra/logger.js';
import {
  SlackOAuthStateEntity,
  OAUTH_STATE_TTL_SECONDS,
} from '../../../shared/infra/db/entities/SlackOAuthStateEntity.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { ConnectSlackUseCase } from '../application/connect-slack.usecase.js';
import type { DisconnectSlackUseCase } from '../application/disconnect-slack.usecase.js';
import type { UpdateSlackConfigUseCase } from '../application/update-slack-config.usecase.js';
import type { SlackConfigResponse } from '../../tenant/domain/tenant.entity.js';
import type {
  TokenEncryption,
  EncryptedPayload,
} from '../../../shared/application/ports/token-encryption.port.js';

const SLACK_SCOPES = 'incoming-webhook,chat:write,channels:read';

/** Channel validation regex — enforced on both PATCH and storage */
const CHANNEL_REGEX = /^#[a-z0-9_-]{1,79}$/;

export interface SlackOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  stateSecret: string;
  signingSecret: string;
}

export interface SlackRouteDeps {
  connectSlack: Pick<ConnectSlackUseCase, 'execute'>;
  disconnectSlack: Pick<DisconnectSlackUseCase, 'execute'>;
  updateSlackConfig: Pick<UpdateSlackConfigUseCase, 'execute'>;
  tenantRepo: Pick<
    ITenantRepository,
    'findById' | 'create' | 'findBySlug' | 'findByCustomDomain' | 'update' | 'listByOwner'
  >;
  slackConfig: SlackOAuthConfig;
  tokenEncryption: TokenEncryption;
}

/**
 * Generate a HMAC-SHA256 state token for CSRF protection.
 * Format: base64url(HMAC-SHA256(tenantId:timestamp, stateSecret))
 */
function generateState(tenantId: string, stateSecret: string): string {
  const payload = `${tenantId}:${Date.now()}`;
  const hmac = createHmac('sha256', stateSecret).update(payload).digest('base64url');
  // Embed payload (base64url) so we can decode it on callback without DB lookup
  // Format: <payload_b64>.<hmac>
  const payloadB64 = Buffer.from(payload).toString('base64url');
  return `${payloadB64}.${hmac}`;
}

/**
 * Verify an HMAC state token.
 * Returns tenantId if valid, null if invalid.
 */
function verifyState(
  state: string,
  stateSecret: string,
): { tenantId: string; valid: boolean } | null {
  const parts = state.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, hmac] = parts;
  if (!payloadB64 || !hmac) return null;

  let payload: string;
  try {
    payload = Buffer.from(payloadB64, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expectedHmac = createHmac('sha256', stateSecret).update(payload).digest('base64url');

  // Constant-time comparison
  try {
    const valid = timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
    if (!valid) return null;
  } catch {
    return null;
  }

  const colonIdx = payload.lastIndexOf(':');
  if (colonIdx < 0) return null;

  const tid = payload.substring(0, colonIdx);
  const ts = parseInt(payload.substring(colonIdx + 1), 10);

  if (!tid || isNaN(ts)) return null;

  // Check timestamp is within TTL
  const ageMs = Date.now() - ts;
  if (ageMs > OAUTH_STATE_TTL_SECONDS * 1000) return null;

  return { tenantId: tid, valid: true };
}

export function createSlackRoutes(deps: SlackRouteDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const { slackConfig } = deps;

  // Propagate AppError status codes (ValidationError → 400, etc.)
  app.onError((err, c) => {
    const maybeAppErr = err as unknown as {
      statusCode?: number;
      toJSON?: () => Record<string, unknown>;
    };
    if (typeof maybeAppErr.statusCode === 'number' && typeof maybeAppErr.toJSON === 'function') {
      return c.json(maybeAppErr.toJSON(), maybeAppErr.statusCode as any);
    }
    throw err;
  });

  // ─── GET /oauth/authorize ─────────────────────────────────────────────────
  // Builds Slack OAuth URL, signs state HMAC, redirects to Slack
  app.get('/oauth/authorize', requireRole('admin'), async (c) => {
    const tid = String(c.get('tenantId')!);

    const state = generateState(tid, slackConfig.stateSecret);

    // Persist state to DynamoDB with TTL for additional server-side verification
    try {
      await SlackOAuthStateEntity.create({
        state,
        tenantId: tid,
        ttl: Math.floor(Date.now() / 1000) + OAUTH_STATE_TTL_SECONDS,
      }).go();
    } catch (err) {
      logger.warn(
        { tenantId: tid, err: err instanceof Error ? err.message : 'unknown' },
        'Failed to persist OAuth state (non-fatal)',
      );
    }

    const params = new URLSearchParams({
      client_id: slackConfig.clientId,
      scope: SLACK_SCOPES,
      redirect_uri: slackConfig.redirectUri,
      state,
    });

    return c.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
  });

  // ─── GET /oauth/callback ──────────────────────────────────────────────────
  // Verifies state, exchanges code, stores config, redirects to dashboard
  app.get('/oauth/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    if (error) {
      logger.warn({ error }, 'Slack OAuth callback received error');
      return c.redirect(
        `${process.env['DASHBOARD_URL'] ?? 'https://dashboard.causeflow.ai'}/dashboard/settings?tab=notifications&slack_error=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      return c.json({ error: 'Missing code or state parameter' }, 400);
    }

    // Verify HMAC state (primary CSRF check)
    const stateResult = verifyState(state, slackConfig.stateSecret);
    if (!stateResult) {
      logger.warn({ state }, 'Invalid or expired OAuth state on Slack callback');
      return c.json({ error: 'Invalid or expired state parameter' }, 400);
    }

    // Secondary: verify state was recorded in DynamoDB
    try {
      const storedState = await SlackOAuthStateEntity.get({ state }).go();
      if (!storedState.data) {
        logger.warn({ tenantId: stateResult.tenantId }, 'OAuth state not found in DynamoDB');
        return c.json({ error: 'State not found or already used' }, 400);
      }
      // Delete state record (single-use)
      await SlackOAuthStateEntity.delete({ state }).go();
    } catch (err) {
      // If DynamoDB is unavailable, the HMAC check already passed — log and continue
      logger.warn(
        { err: err instanceof Error ? err.message : 'unknown' },
        'DynamoDB state lookup failed, relying on HMAC only',
      );
    }

    const tid = tenantId(stateResult.tenantId);

    const result = await deps.connectSlack.execute({ code, tenantId: tid });

    logger.info(
      { tenantId: String(tid), workspaceName: result.workspaceName },
      'Slack OAuth callback completed',
    );

    const dashboardUrl = process.env['DASHBOARD_URL'] ?? 'https://dashboard.causeflow.ai';
    return c.redirect(`${dashboardUrl}/dashboard/settings?tab=notifications&slack=connected`);
  });

  // ─── GET /config ──────────────────────────────────────────────────────────
  // Returns SlackConfigResponse (no sensitive fields)
  app.get('/config', requireRole('admin'), async (c) => {
    const tid = c.get('tenantId')!;
    let tenant;
    try {
      tenant = await deps.tenantRepo.findById(tid);
    } catch (err) {
      logger.warn(
        { tenantId: tid, err: err instanceof Error ? err.message : 'unknown' },
        'Failed to fetch tenant for slack config',
      );
      const response: SlackConfigResponse = { connected: false };
      return c.json(response);
    }

    if (!tenant?.settings?.slackConfig) {
      const response: SlackConfigResponse = { connected: false };
      return c.json(response);
    }

    const { slackConfig: sc } = tenant.settings;
    const response: SlackConfigResponse = {
      connected: true,
      channel: sc.channel,
      workspaceName: sc.workspaceName,
      installedAt: sc.installedAt,
    };
    return c.json(response);
  });

  // ─── PATCH /config ────────────────────────────────────────────────────────
  // Validates channel format, updates, returns SlackConfigResponse
  app.patch('/config', requireRole('admin'), async (c) => {
    const tid = c.get('tenantId')!;
    const body = (await c.req.json()) as { channel?: string };

    if (!body.channel || typeof body.channel !== 'string') {
      throw new ValidationError('channel is required');
    }

    if (!CHANNEL_REGEX.test(body.channel)) {
      throw new ValidationError('Invalid channel format. Must match ^#[a-z0-9_-]{1,79}$', {
        channel: body.channel,
      });
    }

    let result;
    try {
      result = await deps.updateSlackConfig.execute({
        tenantId: tid,
        channel: body.channel,
      });
    } catch (err) {
      logger.warn(
        { tenantId: tid, err: err instanceof Error ? err.message : 'unknown' },
        'Failed to update slack config',
      );
      return c.json({ error: 'Failed to update Slack configuration' }, 500);
    }

    return c.json(result);
  });

  // ─── DELETE /oauth ────────────────────────────────────────────────────────
  // Disconnects Slack integration, returns 204
  app.delete('/oauth', requireRole('admin'), async (c) => {
    const tid = c.get('tenantId')!;

    try {
      await deps.disconnectSlack.execute({ tenantId: tid });
    } catch (err) {
      logger.warn(
        { tenantId: tid, err: err instanceof Error ? err.message : 'unknown' },
        'Failed to disconnect slack',
      );
      return c.json({ error: 'Failed to disconnect Slack' }, 500);
    }

    return c.body(null, 204);
  });

  /** Decrypt a stored Slack access token (handles both encrypted and legacy plaintext). */
  async function decryptToken(raw: string): Promise<string> {
    try {
      const encrypted: EncryptedPayload = JSON.parse(raw);
      if (encrypted.ciphertext && encrypted.encryptedDek) {
        return await deps.tokenEncryption.decrypt(encrypted);
      }
    } catch {
      // Not JSON or not an EncryptedPayload — treat as legacy plaintext
    }
    return raw;
  }

  // ─── POST /test ───────────────────────────────────────────────────────────
  // Test Slack connection using tenant's stored config
  app.post('/test', requireRole('admin'), async (c) => {
    const tid = c.get('tenantId');
    let tenant;
    try {
      tenant = await deps.tenantRepo.findById(tid);
    } catch (err) {
      logger.warn(
        { tenantId: tid, err: err instanceof Error ? err.message : 'unknown' },
        'Failed to fetch tenant for slack test',
      );
      return c.json({ ok: false, error: 'Slack not configured' }, 400);
    }
    if (!tenant?.settings?.slackConfig) {
      return c.json({ ok: false, error: 'Slack not configured' }, 400);
    }
    const plainToken = await decryptToken(tenant.settings.slackConfig.accessToken);
    const client = new WebClient(plainToken);
    try {
      await client.auth.test();
      return c.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'auth.test failed';
      return c.json({ ok: false, error: message });
    }
  });

  // ─── POST /install ────────────────────────────────────────────────────────
  // Initiates the Slack OAuth flow. Generates a state token, persists it, and
  // returns the Slack authorization URL. Equivalent to GET /oauth/authorize but
  // returns JSON instead of a 302 redirect.
  app.post('/install', requireRole('admin'), async (c) => {
    const tid = String(c.get('tenantId')!);

    const state = generateState(tid, slackConfig.stateSecret);

    // Persist state to DynamoDB with TTL for additional server-side verification
    try {
      await SlackOAuthStateEntity.create({
        state,
        tenantId: tid,
        ttl: Math.floor(Date.now() / 1000) + OAUTH_STATE_TTL_SECONDS,
      }).go();
    } catch (err) {
      logger.warn(
        { tenantId: tid, err: err instanceof Error ? err.message : 'unknown' },
        'Failed to persist OAuth state (non-fatal)',
      );
    }

    const params = new URLSearchParams({
      client_id: slackConfig.clientId,
      scope: SLACK_SCOPES,
      redirect_uri: slackConfig.redirectUri,
      state,
    });

    return c.json({
      authUrl: `https://slack.com/oauth/v2/authorize?${params.toString()}`,
      state,
    });
  });

  // ─── POST /events ─────────────────────────────────────────────────────────
  // Receives Slack Events API callbacks. Verifies the request signature using
  // the Slack signing secret, responds to URL verification challenges, and
  // acknowledges events. Returns 401 for tampered bodies.
  app.post('/events', async (c) => {
    const rawBody = await c.req.text();

    // Parse event payload to determine type
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    // Handle URL verification challenge (Slack sends this during setup WITHOUT signature headers)
    if (body.type === 'url_verification' && typeof body.challenge === 'string') {
      return c.json({ challenge: body.challenge });
    }

    // All other events require signature verification
    const signature = c.req.header('X-Slack-Signature');
    const timestamp = c.req.header('X-Slack-Request-Timestamp');

    if (slackConfig.signingSecret) {
      if (!signature || !timestamp) {
        logger.warn({}, 'Slack event missing signature headers');
        return c.json({ error: 'Missing signature headers' }, 401);
      }

      // Reject timestamps older than 5 minutes (anti-replay)
      const now = Math.floor(Date.now() / 1000);
      const ts = parseInt(timestamp, 10);
      if (isNaN(ts) || Math.abs(now - ts) > 300) {
        logger.warn({ timestamp }, 'Slack event timestamp rejected (stale or invalid)');
        return c.json({ error: 'Invalid timestamp' }, 401);
      }

      const base = `v0:${timestamp}:${rawBody}`;
      const expectedSig = `v0=${createHmac('sha256', slackConfig.signingSecret)
        .update(base)
        .digest('hex')}`;

      try {
        const valid = timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
        if (!valid) {
          logger.warn({}, 'Slack event signature mismatch');
          return c.json({ error: 'Invalid signature' }, 401);
        }
      } catch {
        logger.warn({}, 'Slack event signature comparison failed');
        return c.json({ error: 'Signature verification error' }, 401);
      }
    } else {
      logger.warn({}, 'Slack signing secret not configured — skipping event verification');
    }

    // Handle event callbacks
    if (body.type === 'event_callback' && body.event) {
      const event = body.event as Record<string, unknown>;
      const eventType = event.type as string;
      const teamId = body.team_id as string | undefined;

      logger.info({ eventType, teamId, eventTs: event.event_ts }, 'Received Slack event');

      // Acknowledge the event immediately (Slack expects a 200),
      // then attempt to reply asynchronously
      if (teamId && (eventType === 'message' || eventType === 'app_mention')) {
        // Fire-and-forget reply — never block Slack's 200 acknowledgement
        replyToEvent(teamId, event, deps, decryptToken).catch((err) => {
          logger.warn(
            { err: err instanceof Error ? err.message : 'unknown', eventType, teamId },
            'Slack event reply failed (swallowed)',
          );
        });
      }

      return c.json({ ok: true });
    }

    return c.json({ ok: true });
  });

  /**
   * Fire-and-forget reply to a Slack message event.
   * Looks up the tenant by workspace ID using a full-table scan (MVP approach).
   * In production this should use a dedicated GSI.
   */
  async function replyToEvent(
    teamId: string,
    event: Record<string, unknown>,
    deps: SlackRouteDeps,
    decryptTokenFn: (raw: string) => Promise<string>,
  ): Promise<void> {
    // Find the tenant whose Slack workspace matches this teamId.
    // We scan all accessible tenants — for MVP this is acceptable;
    // a future optimization should add a workspaceId → tenantId GSI.
    let tenant;
    try {
      // Query all tenants by scanning the TenantEntity directly
      const { TenantEntity } = await import('../../../shared/infra/db/entities/TenantEntity.js');
      const result = await TenantEntity.scan.go({ limit: 100 });
      tenant = (result.data as Array<Record<string, unknown>>).find(
        (t: Record<string, unknown>) => {
          const settings = t.settings as Record<string, unknown> | undefined;
          const slackCfg = settings?.slackConfig as Record<string, unknown> | undefined;
          return slackCfg?.workspaceId === teamId;
        },
      );
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : 'unknown', teamId },
        'Failed to scan tenants for Slack reply',
      );
      return;
    }

    if (!tenant) {
      logger.debug({ teamId }, 'No tenant found for Slack workspace — skipping reply');
      return;
    }

    const settings = tenant.settings as Record<string, unknown> | undefined;
    const slackCfg = settings?.slackConfig as Record<string, unknown> | undefined;
    if (!slackCfg?.accessToken) {
      logger.debug({ teamId }, 'Tenant has no Slack config — skipping reply');
      return;
    }

    const plainToken = await decryptTokenFn(slackCfg.accessToken as string);

    const { WebClient } = await import('@slack/web-api');
    const client = new WebClient(plainToken);
    const channel = (event.channel as string) || (slackCfg.channel as string);
    const threadTs = (event.thread_ts as string) || (event.ts as string) || undefined;

    const replyText = `Test event received by CauseFlow in channel <#${channel}>.`;

    try {
      await client.chat.postMessage({
        channel,
        text: replyText,
        ...(threadTs ? { thread_ts: threadTs } : {}),
      });
      logger.info({ teamId, channel, threadTs }, 'Slack reply sent');
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : 'unknown', teamId, channel },
        'Slack chat.postMessage failed (swallowed)',
      );
    }
  }

  return app;
}

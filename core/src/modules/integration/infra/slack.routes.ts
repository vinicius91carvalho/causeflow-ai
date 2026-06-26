import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { WebClient } from '@slack/web-api';
import { requireRole } from '../../../shared/infra/http/middleware/rbac.middleware.js';
import { tenantId } from '../../../shared/domain/value-objects.js';
import { ValidationError } from '../../../shared/domain/errors.js';
import { logger } from '../../../shared/infra/logger.js';
import { SlackOAuthStateEntity, OAUTH_STATE_TTL_SECONDS } from '../../../shared/infra/db/entities/SlackOAuthStateEntity.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { ConnectSlackUseCase } from '../application/connect-slack.usecase.js';
import type { DisconnectSlackUseCase } from '../application/disconnect-slack.usecase.js';
import type { UpdateSlackConfigUseCase } from '../application/update-slack-config.usecase.js';
import type { SlackConfigResponse } from '../../tenant/domain/tenant.entity.js';

const SLACK_SCOPES = 'incoming-webhook,chat:write,channels:read';

/** Channel validation regex — enforced on both PATCH and storage */
const CHANNEL_REGEX = /^#[a-z0-9_-]{1,79}$/;

export interface SlackOAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    stateSecret: string;
}

export interface SlackRouteDeps {
    connectSlack: Pick<ConnectSlackUseCase, 'execute'>;
    disconnectSlack: Pick<DisconnectSlackUseCase, 'execute'>;
    updateSlackConfig: Pick<UpdateSlackConfigUseCase, 'execute'>;
    tenantRepo: Pick<ITenantRepository, 'findById' | 'create' | 'findBySlug' | 'findByCustomDomain' | 'update' | 'listByOwner'>;
    slackConfig: SlackOAuthConfig;
}

/**
 * Generate a HMAC-SHA256 state token for CSRF protection.
 * Format: base64url(HMAC-SHA256(tenantId:timestamp, stateSecret))
 */
function generateState(tenantId: string, stateSecret: string): string {
    const payload = `${tenantId}:${Date.now()}`;
    const hmac = createHmac('sha256', stateSecret)
        .update(payload)
        .digest('base64url');
    // Embed payload (base64url) so we can decode it on callback without DB lookup
    // Format: <payload_b64>.<hmac>
    const payloadB64 = Buffer.from(payload).toString('base64url');
    return `${payloadB64}.${hmac}`;
}

/**
 * Verify an HMAC state token.
 * Returns tenantId if valid, null if invalid.
 */
function verifyState(state: string, stateSecret: string): { tenantId: string; valid: boolean } | null {
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

    const expectedHmac = createHmac('sha256', stateSecret)
        .update(payload)
        .digest('base64url');

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
        const maybeAppErr = err as unknown as { statusCode?: number; toJSON?: () => Record<string, unknown> };
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
            logger.warn({ tenantId: tid, err: err instanceof Error ? err.message : 'unknown' }, 'Failed to persist OAuth state (non-fatal)');
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
            return c.redirect(`${process.env['DASHBOARD_URL'] ?? 'https://dashboard.causeflow.ai'}/dashboard/settings?tab=notifications&slack_error=${encodeURIComponent(error)}`);
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
            logger.warn({ err: err instanceof Error ? err.message : 'unknown' }, 'DynamoDB state lookup failed, relying on HMAC only');
        }

        const tid = tenantId(stateResult.tenantId);

        const result = await deps.connectSlack.execute({ code, tenantId: tid });

        logger.info({ tenantId: String(tid), workspaceName: result.workspaceName }, 'Slack OAuth callback completed');

        const dashboardUrl = process.env['DASHBOARD_URL'] ?? 'https://dashboard.causeflow.ai';
        return c.redirect(`${dashboardUrl}/dashboard/settings?tab=notifications&slack=connected`);
    });

    // ─── GET /config ──────────────────────────────────────────────────────────
    // Returns SlackConfigResponse (no sensitive fields)
    app.get('/config', requireRole('admin'), async (c) => {
        const tid = c.get('tenantId')!;
        const tenant = await deps.tenantRepo.findById(tid);

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
        const body = await c.req.json() as { channel?: string };

        if (!body.channel || typeof body.channel !== 'string') {
            throw new ValidationError('channel is required');
        }

        if (!CHANNEL_REGEX.test(body.channel)) {
            throw new ValidationError(
                'Invalid channel format. Must match ^#[a-z0-9_-]{1,79}$',
                { channel: body.channel },
            );
        }

        const result = await deps.updateSlackConfig.execute({
            tenantId: tid,
            channel: body.channel,
        });

        return c.json(result);
    });

    // ─── DELETE /oauth ────────────────────────────────────────────────────────
    // Disconnects Slack integration, returns 204
    app.delete('/oauth', requireRole('admin'), async (c) => {
        const tid = c.get('tenantId')!;

        await deps.disconnectSlack.execute({ tenantId: tid });

        return c.body(null, 204);
    });

    // ─── POST /test ───────────────────────────────────────────────────────────
    // Test Slack connection using tenant's stored config
    app.post('/test', requireRole('admin'), async (c) => {
        const tid = c.get('tenantId');
        const tenant = await deps.tenantRepo.findById(tid);
        if (!tenant?.settings?.slackConfig) {
            return c.json({ ok: false, error: 'Slack not configured' }, 400);
        }
        const client = new WebClient(tenant.settings.slackConfig.accessToken);
        try {
            await client.auth.test();
            return c.json({ ok: true });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'auth.test failed';
            return c.json({ ok: false, error: message });
        }
    });

    return app;
}

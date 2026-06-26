import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { IRelayGateway } from '../../../shared/application/ports/relay-gateway.port.js';
import { issueRelayToken } from '../../../shared/infra/relay/relay-auth.js';

export function createRelayRoutes(relayGateway: IRelayGateway): Hono<AppEnv> {
    const app = new Hono<AppEnv>();

    app.get('/status', async (c) => {
        const tid = c.get('tenantId');
        const connected = relayGateway.isConnected(tid);
        const resources = connected ? await relayGateway.listResources(tid) : [];
        return c.json({ connected, resources });
    });

    app.post('/tokens', async (c) => {
        const tid = c.get('tenantId');
        const body = (await c.req.json<{ relayId?: string; ttlSeconds?: number }>().catch(() => ({}))) as {
            relayId?: string;
            ttlSeconds?: number;
        };
        const relayId = body.relayId ?? uuidv4();
        const ttlSeconds = Math.min(Math.max(body.ttlSeconds ?? 86_400, 300), 86_400 * 7);
        const token = await issueRelayToken({ tenantId: tid, relayId, ttlSeconds });
        return c.json({ token, relayId, expiresInSeconds: ttlSeconds });
    });

    return app;
}

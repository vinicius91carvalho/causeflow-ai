import { WebSocketServer, type WebSocket } from 'ws';
import { parseRelayMessage } from './relay-protocol.js';
import { verifyRelayToken } from './relay-auth.js';
import { logger } from '../logger.js';
import type { Server as HttpServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { RelayRegistry } from './relay-registry.js';

export function createRelayWSServer(
    server: HttpServer,
    registry: RelayRegistry,
    wsPath: string,
): WebSocketServer {
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        if (url.pathname !== wsPath) return;

        // Token MUST be in Authorization header (no query-string tokens).
        const authHeader = req.headers['authorization'];
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
        if (!token) {
            logger.warn({ path: url.pathname }, 'Relay WS missing Authorization header');
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }

        verifyRelayToken(token)
            .then((payload) => {
                const tenantHeader = req.headers['x-tenant-id'];
                if (typeof tenantHeader === 'string' && tenantHeader !== payload.tenantId) {
                    logger.warn({ claim: payload.tenantId, header: tenantHeader }, 'Relay WS tenant mismatch');
                    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                    socket.destroy();
                    return;
                }
                wss.handleUpgrade(req, socket, head, (ws) => {
                    wss.emit('connection', ws, req, payload.tenantId, payload.relayId);
                });
            })
            .catch((err) => {
                logger.warn({ err: err instanceof Error ? err.message : err, path: url.pathname }, 'Relay WS JWT verification failed');
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
            });
    });

    wss.on('connection', (ws: WebSocket, _req: IncomingMessage, tenantId: string, relayId: string) => {
        registry.register(tenantId, relayId, ws);
        ws.on('message', (data: string | Buffer) => {
            try {
                const raw = typeof data === 'string' ? data : data.toString();
                const msg = parseRelayMessage(raw);
                if ('type' in msg && msg.type === 'heartbeat') {
                    registry.updateHeartbeat(tenantId, relayId);
                    return;
                }
                if ('type' in msg && msg.type === 'resource_update') {
                    registry.updateResources(tenantId, relayId, msg.resources);
                    return;
                }
            } catch (err) {
                logger.warn({ err, tenantId, relayId }, 'Invalid relay message');
            }
        });

        ws.on('close', () => {
            registry.unregister(tenantId, relayId);
        });
        ws.on('error', (err: Error) => {
            logger.error({ err, tenantId, relayId }, 'Relay WS error');
            registry.unregister(tenantId, relayId);
        });
    });

    return wss;
}

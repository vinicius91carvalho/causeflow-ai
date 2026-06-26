/**
 * WebSocket server for investigation sessions.
 *
 * Handles bidirectional communication between dashboard users and
 * Fargate investigation workers. Scoped by tenantId:incidentId.
 *
 * Reuses the existing relay WS upgrade pattern from relay-ws-server.ts.
 */
import { WebSocketServer, type WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { verifyRelayToken } from './investigation-relay-auth.js';
import { logger } from '../logger.js';
import { getLogger } from '../logger/log-context.js';
import type { Server as HttpServer } from 'node:http';
import type { AgentToUserMessage } from './investigation-relay-protocol.js';

interface InvestigationConnection {
    id: string;
    ws: WebSocket;
    role: 'dashboard' | 'worker';
    tenantId: string;
    incidentId: string;
    connectedAt: number;
}

/** Callback to dispatch a followup Fargate worker for a session with no worker. */
export type WorkerDispatcher = (tenantId: string, incidentId: string) => Promise<void>;

/** Grace period before shutting down a worker whose dashboards have all disconnected. */
const NO_OBSERVERS_GRACE_MS = 30_000;

/**
 * Registry of active investigation sessions.
 * Key: `${tenantId}:${incidentId}`
 * Value: Set of connections (multiple dashboard tabs + one worker)
 */
export class InvestigationRelayRegistry {
    private sessions = new Map<string, Map<string, InvestigationConnection>>();
    private guidanceHandlers = new Map<string, (guidance: string) => void>();
    /** Tracks sessions where we've already dispatched a followup worker and are waiting for it. */
    private dispatchInFlight = new Set<string>();
    /** Tracks pending "no observers → shutdown" timers so a reconnect can cancel them. */
    private noObserverTimers = new Map<string, NodeJS.Timeout>();
    private dispatcher?: WorkerDispatcher;

    setDispatcher(dispatcher: WorkerDispatcher): void {
        this.dispatcher = dispatcher;
    }

    private key(tenantId: string, incidentId: string): string {
        return `${tenantId}:${incidentId}`;
    }

    private hasWorker(sessionKey: string): boolean {
        const conns = this.sessions.get(sessionKey);
        if (!conns) return false;
        for (const conn of conns.values()) {
            if (conn.role === 'worker' && conn.ws.readyState === conn.ws.OPEN) return true;
        }
        return false;
    }

    private hasDashboard(sessionKey: string): boolean {
        const conns = this.sessions.get(sessionKey);
        if (!conns) return false;
        for (const conn of conns.values()) {
            if (conn.role === 'dashboard' && conn.ws.readyState === conn.ws.OPEN) return true;
        }
        return false;
    }

    private sendWorkerStatus(
        tenantId: string,
        incidentId: string,
        status: 'no_worker' | 'provisioning' | 'ready' | 'disconnected',
    ): void {
        this.broadcastToUser(tenantId, incidentId, {
            type: 'worker_status',
            incidentId,
            status,
            timestamp: new Date().toISOString(),
        });
    }

    register(tenantId: string, incidentId: string, ws: WebSocket, role: 'dashboard' | 'worker'): string {
        const sessionKey = this.key(tenantId, incidentId);
        if (!this.sessions.has(sessionKey)) {
            this.sessions.set(sessionKey, new Map());
        }
        const id = uuidv4();
        this.sessions.get(sessionKey)!.set(id, {
            id, ws, role, tenantId, incidentId,
            connectedAt: Date.now(),
        });
        logger.info({ tenantId, incidentId, role, id }, 'Investigation relay connected');

        if (role === 'worker') {
            // Worker is now alive — clear any pending dispatch flag and notify dashboards.
            this.dispatchInFlight.delete(sessionKey);
            this.sendWorkerStatus(tenantId, incidentId, 'ready');
        } else {
            // Dashboard is now watching — cancel any pending "no observers" shutdown.
            const pending = this.noObserverTimers.get(sessionKey);
            if (pending) {
                clearTimeout(pending);
                this.noObserverTimers.delete(sessionKey);
            }
            // Tell this new dashboard what the worker state currently is. Send to the
            // whole session (extra broadcasts to other tabs are harmless and keep state in sync).
            if (this.hasWorker(sessionKey)) {
                this.sendWorkerStatus(tenantId, incidentId, 'ready');
            } else if (this.dispatchInFlight.has(sessionKey)) {
                this.sendWorkerStatus(tenantId, incidentId, 'provisioning');
            } else {
                this.sendWorkerStatus(tenantId, incidentId, 'no_worker');
            }
        }

        return id;
    }

    unregister(tenantId: string, incidentId: string, id: string): void {
        const sessionKey = this.key(tenantId, incidentId);
        const conn = this.sessions.get(sessionKey)?.get(id);
        const wasRole = conn?.role;
        this.sessions.get(sessionKey)?.delete(id);

        if (wasRole === 'worker') {
            // Worker dropped — tell dashboards and clear any provisioning flag.
            this.dispatchInFlight.delete(sessionKey);
            if (this.hasDashboard(sessionKey)) {
                this.sendWorkerStatus(tenantId, incidentId, 'disconnected');
            }
        } else if (wasRole === 'dashboard') {
            // Dashboard dropped — if no more observers and a worker is alive, schedule
            // a graceful shutdown of the worker so we stop paying for idle Fargate time.
            if (!this.hasDashboard(sessionKey) && this.hasWorker(sessionKey)) {
                const timer = setTimeout(() => {
                    this.noObserverTimers.delete(sessionKey);
                    if (this.hasDashboard(sessionKey) || !this.hasWorker(sessionKey)) return;
                    logger.info({ tenantId, incidentId }, 'No dashboard observers — requesting worker shutdown');
                    this.sendToWorker(tenantId, incidentId, JSON.stringify({ type: 'shutdown', reason: 'no_observers' }));
                }, NO_OBSERVERS_GRACE_MS);
                this.noObserverTimers.set(sessionKey, timer);
            }
        }

        if (this.sessions.get(sessionKey)?.size === 0) {
            this.sessions.delete(sessionKey);
            this.guidanceHandlers.delete(sessionKey);
            const timer = this.noObserverTimers.get(sessionKey);
            if (timer) { clearTimeout(timer); this.noObserverTimers.delete(sessionKey); }
            this.dispatchInFlight.delete(sessionKey);
        }
        logger.info({ tenantId, incidentId, id }, 'Investigation relay disconnected');
    }

    /** Send a message from agent to all dashboard connections for this investigation */
    broadcastToUser(tenantId: string, incidentId: string, message: AgentToUserMessage): void {
        const sessionKey = this.key(tenantId, incidentId);
        const conns = this.sessions.get(sessionKey);
        if (!conns) return;

        let delivered = 0;
        const data = JSON.stringify(message);
        for (const conn of conns.values()) {
            if (conn.role === 'dashboard' && conn.ws.readyState === conn.ws.OPEN) {
                conn.ws.send(data);
                delivered++;
            }
        }
        getLogger().info({
            event: 'wss.broadcast',
            target: 'user',
            tenantId,
            incidentId,
            messageType: (message as { type?: string }).type,
            delivered,
        }, 'wss.broadcast');
    }

    /** Send a message from user to the worker connection */
    sendToWorker(tenantId: string, incidentId: string, data: string): void {
        const sessionKey = this.key(tenantId, incidentId);
        const conns = this.sessions.get(sessionKey);
        if (!conns) return;

        let delivered = false;
        for (const conn of conns.values()) {
            if (conn.role === 'worker' && conn.ws.readyState === conn.ws.OPEN) {
                conn.ws.send(data);
                delivered = true;
                break;
            }
        }
        getLogger().info({ event: 'wss.send', target: 'worker', tenantId, incidentId, delivered }, 'wss.send');
    }

    /**
     * Handle dashboard-originated guidance. If a worker is alive, route it through.
     * Otherwise dispatch a followup worker on demand and ask the dashboard to buffer
     * until the worker comes online.
     *
     * The dashboard is expected to treat `worker_status: provisioning` as the signal
     * to re-send its buffered guidance once it sees `worker_status: ready`.
     */
    routeGuidance(tenantId: string, incidentId: string, guidance: string, rawMessage: string): void {
        const sessionKey = this.key(tenantId, incidentId);
        if (this.hasWorker(sessionKey)) {
            // Empty guidance is a pure "ensure worker" ping from the dashboard — if a worker
            // is already present, just reassure the client with a ready status and drop the
            // empty message so the worker isn't woken up for nothing.
            if (!guidance || guidance.length === 0) {
                this.sendWorkerStatus(tenantId, incidentId, 'ready');
                return;
            }
            const handler = this.guidanceHandlers.get(sessionKey);
            if (handler) handler(guidance);
            else this.sendToWorker(tenantId, incidentId, rawMessage);
            return;
        }

        // No worker — dispatch once per session and tell the dashboard to hold.
        this.sendWorkerStatus(tenantId, incidentId, 'provisioning');
        if (this.dispatchInFlight.has(sessionKey) || !this.dispatcher) return;

        this.dispatchInFlight.add(sessionKey);
        logger.info({ tenantId, incidentId }, 'No worker connected — dispatching followup on demand');
        this.dispatcher(tenantId, incidentId).catch((err) => {
            logger.warn({ err, tenantId, incidentId }, 'Failed to dispatch followup worker');
            this.dispatchInFlight.delete(sessionKey);
            this.sendWorkerStatus(tenantId, incidentId, 'no_worker');
        });
    }

    /** Register handler for guidance messages directed at a specific investigation */
    onGuidance(tenantId: string, incidentId: string, handler: (guidance: string) => void): void {
        this.guidanceHandlers.set(this.key(tenantId, incidentId), handler);
    }

    /** Dispatch guidance to the registered handler */
    dispatchGuidance(tenantId: string, incidentId: string, guidance: string): void {
        const handler = this.guidanceHandlers.get(this.key(tenantId, incidentId));
        if (handler) handler(guidance);
    }

    /** Check if any dashboard user is observing this investigation */
    hasObservers(tenantId: string, incidentId: string): boolean {
        return this.hasDashboard(this.key(tenantId, incidentId));
    }

    shutdown(): void {
        for (const timer of this.noObserverTimers.values()) clearTimeout(timer);
        this.noObserverTimers.clear();
        for (const conns of this.sessions.values()) {
            for (const conn of conns.values()) {
                try { conn.ws.close(); } catch { /* ignore */ }
            }
        }
        this.sessions.clear();
        this.guidanceHandlers.clear();
        this.dispatchInFlight.clear();
    }
}

/**
 * Create the investigation WebSocket server.
 * Handles upgrade at the specified path (e.g., /v1/investigation/ws).
 */
export function createInvestigationRelayServer(
    server: HttpServer,
    registry: InvestigationRelayRegistry,
    _authSecret: string,
    wsPath: string,
): WebSocketServer {
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        if (url.pathname !== wsPath) return;

        // Auth: JWT token from Bearer header or query param
        const authHeader = req.headers['authorization'];
        const token = authHeader?.startsWith('Bearer ')
            ? authHeader.slice(7)
            : url.searchParams.get('token');

        if (!token) {
            logger.warn({ path: url.pathname }, 'Investigation relay: no token');
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }

        // Verify JWT and extract tenantId, incidentId, role
        verifyRelayToken(token).then((payload) => {
            wss.handleUpgrade(req, socket, head, (ws) => {
                wss.emit('connection', ws, payload.tenantId, payload.incidentId, payload.role);
            });
        }).catch((err) => {
            logger.warn({ err: err instanceof Error ? err.message : err, path: url.pathname }, 'Investigation relay auth failed');
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
        });
    });

    wss.on('connection', (ws: WebSocket, tenantId: string, incidentId: string, role: 'dashboard' | 'worker') => {
        const connId = registry.register(tenantId, incidentId, ws, role);

        // Server-side heartbeat every 30s to prevent ALB idle timeout (default 60s, configured to 300s)
        const heartbeatInterval = setInterval(() => {
            if (ws.readyState === ws.OPEN) {
                ws.ping();
            } else {
                clearInterval(heartbeatInterval);
            }
        }, 30_000);

        ws.on('message', (data: string | Buffer) => {
            try {
                const raw = typeof data === 'string' ? data : data.toString();
                const msg = JSON.parse(raw) as { type: string; message?: string };

                if (msg.type === 'heartbeat') return;

                if (role === 'worker') {
                    // Worker → broadcast to all dashboard connections (checkpoint, progress, complete, idle, followup, question, error)
                    registry.broadcastToUser(tenantId, incidentId, msg as import('./investigation-relay-protocol.js').AgentToUserMessage);
                } else {
                    // Dashboard → route to worker
                    if (msg.type === 'guidance') {
                        registry.routeGuidance(tenantId, incidentId, msg.message ?? '', raw);
                    } else if (msg.type === 'answer' || msg.type === 'abort') {
                        registry.sendToWorker(tenantId, incidentId, raw);
                    }
                }
            } catch (err) {
                logger.warn({ err, tenantId, incidentId, role }, 'Invalid investigation relay message');
            }
        });

        ws.on('close', () => {
            clearInterval(heartbeatInterval);
            registry.unregister(tenantId, incidentId, connId);
        });
        ws.on('error', (err: Error) => {
            clearInterval(heartbeatInterval);
            logger.error({ err, tenantId, incidentId }, 'Investigation relay error');
            registry.unregister(tenantId, incidentId, connId);
        });
    });

    return wss;
}

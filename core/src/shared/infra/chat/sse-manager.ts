import { logger } from '../logger.js';
import type { SSEStreamingApi } from 'hono/streaming';

export interface SSEClient {
    id: string;
    tenantId: string;
    stream: SSEStreamingApi;
}

export interface SSEEvent {
    event: string;
    data: Record<string, unknown>;
    id?: string;
}

export class SSEManager {
    clients = new Map();
    heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    constructor() {
        this.startHeartbeat();
    }
    addClient(tenantId: string, clientId: string, stream: SSEStreamingApi): void {
        if (!this.clients.has(tenantId)) {
            this.clients.set(tenantId, new Map());
        }
        this.clients.get(tenantId).set(clientId, { id: clientId, tenantId, stream });
        logger.info({ tenantId, clientId }, 'SSE client connected');
    }
    removeClient(tenantId: string, clientId: string): void {
        this.clients.get(tenantId)?.delete(clientId);
        if (this.clients.get(tenantId)?.size === 0) {
            this.clients.delete(tenantId);
        }
        logger.info({ tenantId, clientId }, 'SSE client disconnected');
    }
    async broadcast(tenantId: string, event: SSEEvent): Promise<void> {
        const tenantClients = this.clients.get(tenantId);
        if (!tenantClients || tenantClients.size === 0)
            return;
        const deadClients = [];
        for (const [clientId, client] of tenantClients) {
            try {
                await client.stream.writeSSE({
                    event: event.event,
                    data: JSON.stringify(event.data),
                    id: event.id,
                });
            }
            catch {
                deadClients.push(clientId);
            }
        }
        for (const clientId of deadClients) {
            this.removeClient(tenantId, clientId);
        }
    }
    async sendToClient(tenantId: string, clientId: string, event: SSEEvent): Promise<boolean> {
        const client = this.clients.get(tenantId)?.get(clientId);
        if (!client) return false;
        try {
            await client.stream.writeSSE({
                event: event.event,
                data: JSON.stringify(event.data),
                id: event.id,
            });
            return true;
        } catch {
            this.removeClient(tenantId, clientId);
            return false;
        }
    }
    isClientConnected(tenantId: string, clientId: string): boolean {
        return this.clients.get(tenantId)?.has(clientId) ?? false;
    }
    getClientCount(tenantId?: string): number {
        if (tenantId) {
            return this.clients.get(tenantId)?.size ?? 0;
        }
        let total = 0;
        for (const tenantClients of this.clients.values()) {
            total += tenantClients.size;
        }
        return total;
    }
    startHeartbeat() {
        this.heartbeatInterval = setInterval(async () => {
            for (const [tenantId, tenantClients] of this.clients) {
                const deadClients = [];
                for (const [clientId, client] of tenantClients) {
                    try {
                        await client.stream.writeSSE({ event: 'heartbeat', data: '' });
                    }
                    catch {
                        deadClients.push(clientId);
                    }
                }
                for (const clientId of deadClients) {
                    this.removeClient(tenantId, clientId);
                }
            }
        }, 30_000);
    }
    shutdown(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
}

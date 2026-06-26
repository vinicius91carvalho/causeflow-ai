import { logger } from '../logger.js';
import type { WebSocket } from 'ws';
import type { RelayResource } from '../../application/ports/relay-gateway.port.js';

export interface RelayConnection {
    relayId: string;
    tenantId: string;
    ws: WebSocket;
    healthy: boolean;
    lastHeartbeat: number;
    resources: RelayResource[];
}

export class RelayRegistry {
    connections = new Map();
    heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    constructor() {
        this.startHeartbeatCheck();
    }
    register(tenantId: string, relayId: string, ws: WebSocket): void {
        if (!this.connections.has(tenantId)) {
            this.connections.set(tenantId, new Map());
        }
        this.connections.get(tenantId).set(relayId, {
            relayId,
            tenantId,
            ws,
            healthy: true,
            lastHeartbeat: Date.now(),
            resources: [],
        });
        logger.info({ tenantId, relayId }, 'Relay connected');
    }
    unregister(tenantId: string, relayId: string): void {
        this.connections.get(tenantId)?.delete(relayId);
        if (this.connections.get(tenantId)?.size === 0) {
            this.connections.delete(tenantId);
        }
        logger.info({ tenantId, relayId }, 'Relay disconnected');
    }
    getForTenant(tenantId: string): RelayConnection | undefined {
        const tenantConns = this.connections.get(tenantId);
        if (!tenantConns || tenantConns.size === 0)
            return undefined;
        // Return the first healthy connection
        for (const conn of tenantConns.values()) {
            if (conn.healthy)
                return conn;
        }
        // Fallback: return any connection
        return tenantConns.values().next().value;
    }
    isConnected(tenantId: string): boolean {
        const conn = this.getForTenant(tenantId);
        return conn !== undefined && conn.healthy;
    }
    updateHeartbeat(tenantId: string, relayId: string): void {
        const conn = this.connections.get(tenantId)?.get(relayId);
        if (conn) {
            conn.lastHeartbeat = Date.now();
            conn.healthy = true;
        }
    }
    updateResources(tenantId: string, relayId: string, resources: RelayResource[]): void {
        const conn = this.connections.get(tenantId)?.get(relayId);
        if (conn) {
            conn.resources = resources;
        }
    }
    startHeartbeatCheck() {
        this.heartbeatInterval = setInterval(() => {
            const now = Date.now();
            const staleThresholdMs = 90_000; // 3x heartbeat interval
            for (const [tenantId, tenantConns] of this.connections) {
                const stale = [];
                for (const [relayId, conn] of tenantConns) {
                    if (now - conn.lastHeartbeat > staleThresholdMs) {
                        conn.healthy = false;
                        stale.push(relayId);
                    }
                }
                for (const relayId of stale) {
                    const conn = tenantConns.get(relayId);
                    if (conn) {
                        try {
                            conn.ws.close();
                        }
                        catch { /* ignore */ }
                    }
                    this.unregister(tenantId, relayId);
                }
            }
        }, 30_000);
    }
    shutdown(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        for (const tenantConns of this.connections.values()) {
            for (const conn of tenantConns.values()) {
                try {
                    conn.ws.close();
                }
                catch { /* ignore */ }
            }
        }
        this.connections.clear();
    }
}

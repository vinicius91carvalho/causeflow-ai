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
export declare class RelayRegistry {
    private connections;
    private heartbeatInterval;
    constructor();
    register(tenantId: string, relayId: string, ws: WebSocket): void;
    unregister(tenantId: string, relayId: string): void;
    getForTenant(tenantId: string): RelayConnection | undefined;
    isConnected(tenantId: string): boolean;
    updateHeartbeat(tenantId: string, relayId: string): void;
    updateResources(tenantId: string, relayId: string, resources: RelayResource[]): void;
    private startHeartbeatCheck;
    shutdown(): void;
}

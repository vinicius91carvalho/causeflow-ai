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
export declare class SSEManager {
    private clients;
    private heartbeatInterval;
    constructor();
    addClient(tenantId: string, clientId: string, stream: SSEStreamingApi): void;
    removeClient(tenantId: string, clientId: string): void;
    broadcast(tenantId: string, event: SSEEvent): Promise<void>;
    getClientCount(tenantId?: string): number;
    private startHeartbeat;
    shutdown(): void;
}

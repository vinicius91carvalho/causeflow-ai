import { createRpcRequest, relayRpcResponseSchema, type RelayRpcMethod } from './relay-protocol.js';
import { logger } from '../logger.js';
import {
    RelayGatewayError,
    type IRelayGateway,
    type RelayCommand,
    type RelayQueryResult,
    type RelayResource,
} from '../../application/ports/relay-gateway.port.js';
import type { TenantId } from '../../domain/value-objects.js';
import type { RelayRegistry } from './relay-registry.js';

export class WssRelayGateway implements IRelayGateway {
    registry;
    pending = new Map();
    timeoutMs;
    constructor(registry: RelayRegistry, timeoutMs: number = 30_000) {
        this.registry = registry;
        this.timeoutMs = timeoutMs;
    }
    isConnected(tenantId: TenantId): boolean {
        return this.registry.isConnected(tenantId);
    }
    async listResources(tenantId: TenantId): Promise<RelayResource[]> {
        const conn = this.registry.getForTenant(tenantId);
        if (!conn) throw new RelayGatewayError(`No relay connected for tenant ${tenantId}`, 'not_connected');
        if (conn.resources.length > 0) return conn.resources;
        const result = await this.sendRpc(tenantId, 'list_resources', {}) as RelayResource[];
        return result;
    }
    async execute(tenantId: TenantId, command: RelayCommand): Promise<RelayQueryResult> {
        const raw = await this.sendRpc(tenantId, 'execute', {
            resourceId: command.resourceId,
            operation: command.operation,
            params: command.params,
        });
        return this.normalizeQueryResult(raw);
    }
    async describeResource(tenantId: TenantId, resourceId: string): Promise<{ tables: Array<{ name: string; rowCount?: number }>; type: string; database: string }> {
        const result = await this.sendRpc(tenantId, 'describe_resource', { resourceId });
        return result as { tables: Array<{ name: string; rowCount?: number }>; type: string; database: string };
    }

    private normalizeQueryResult(raw: unknown): RelayQueryResult {
        const obj = (raw ?? {}) as Record<string, unknown>;
        return {
            rows: Array.isArray(obj['rows']) ? obj['rows'] as Record<string, unknown>[] : [],
            rowCount: typeof obj['rowCount'] === 'number' ? obj['rowCount'] as number : 0,
            fields: obj['fields'] as RelayQueryResult['fields'],
            executionTimeMs: typeof obj['executionTimeMs'] === 'number' ? obj['executionTimeMs'] as number : 0,
            masked: obj['masked'] === true,
            maskedFieldCount: typeof obj['maskedFieldCount'] === 'number' ? obj['maskedFieldCount'] as number : 0,
            detections: Array.isArray(obj['detections']) ? obj['detections'] as RelayQueryResult['detections'] : undefined,
            warnings: Array.isArray(obj['warnings']) ? obj['warnings'] as string[] : undefined,
            requiresApproval: obj['requiresApproval'] === true,
        };
    }

    async sendRpc(tenantId: TenantId, method: RelayRpcMethod, params: Record<string, unknown>): Promise<unknown> {
        const conn = this.registry.getForTenant(tenantId);
        if (!conn) throw new RelayGatewayError(`No relay connected for tenant ${tenantId}`, 'not_connected');
        const rpcReq = createRpcRequest(method, params);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(rpcReq.id);
                reject(new RelayGatewayError(`Relay RPC timeout after ${this.timeoutMs}ms for method ${method}`, 'relay_timeout', undefined, true));
            }, this.timeoutMs);
            this.pending.set(rpcReq.id, { resolve, reject, timer });
            const messageHandler = (data: string | Buffer) => {
                try {
                    const parsed = JSON.parse(typeof data === 'string' ? data : data.toString());
                    const validated = relayRpcResponseSchema.safeParse(parsed);
                    if (!validated.success) return;
                    const response = validated.data;
                    const pending = this.pending.get(response.id);
                    if (!pending) return;
                    this.pending.delete(response.id);
                    clearTimeout(pending.timer);
                    conn.ws.removeListener('message', messageHandler);
                    if (response.error) {
                        pending.reject(mapRpcError(response.error));
                    } else {
                        pending.resolve(response.result);
                    }
                } catch {
                    /* ignore non-JSON */
                }
            };
            conn.ws.on('message', messageHandler);
            try {
                conn.ws.send(JSON.stringify(rpcReq));
            } catch (err) {
                this.pending.delete(rpcReq.id);
                clearTimeout(timer);
                conn.ws.removeListener('message', messageHandler);
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        });
    }
}

function mapRpcError(err: { code: number; message: string; data?: unknown }): RelayGatewayError {
    switch (err.code) {
        case -32001:
            return new RelayGatewayError(err.message, 'session_denied', err.code, false, err.data);
        case -32010:
            return new RelayGatewayError(err.message, 'rate_limited', err.code, true, err.data);
        case -32011:
            return new RelayGatewayError(err.message, 'approval_required', err.code, false, err.data);
        case -32600:
            return new RelayGatewayError(err.message, 'policy_denied', err.code, false, err.data);
        case -32602:
            return new RelayGatewayError(err.message, 'validation_failed', err.code, false, err.data);
        case -32603:
            return new RelayGatewayError(err.message, 'internal', err.code, false, err.data);
        default:
            return new RelayGatewayError(err.message, 'internal', err.code, false, err.data);
    }
}

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export type RelayRpcMethod = 'execute' | 'health_check' | 'list_resources' | 'describe_resource';

export interface RelayRpcRequest {
    jsonrpc: '2.0';
    id: string;
    method: RelayRpcMethod;
    params: Record<string, unknown>;
}

export interface RelayRpcResponse {
    jsonrpc: '2.0';
    id: string;
    result?: unknown;
    error?: RelayRpcError;
}

export interface RelayRpcError {
    code: number;
    message: string;
    data?: unknown;
}

// --- Zod Validation ---
export const relayRpcResponseSchema = z.object({
    jsonrpc: z.literal('2.0'),
    id: z.string(),
    result: z.unknown().optional(),
    error: z.object({
        code: z.number(),
        message: z.string(),
        data: z.unknown().optional(),
    }).optional(),
});
export const relayHeartbeatSchema = z.object({
    type: z.literal('heartbeat'),
    relayId: z.string(),
    tenantId: z.string(),
});
export const relayResourceUpdateSchema = z.object({
    type: z.literal('resource_update'),
    relayId: z.string(),
    tenantId: z.string(),
    resources: z.array(z.object({
        resourceId: z.string(),
        type: z.enum(['postgres', 'mongodb']),
        name: z.string(),
        database: z.string(),
        readOnly: z.boolean(),
    })),
});
export const relayMessageSchema = z.union([
    relayRpcResponseSchema,
    relayHeartbeatSchema,
    relayResourceUpdateSchema,
]);
// --- Helpers ---
export function createRpcRequest(method: RelayRpcMethod, params: Record<string, unknown>): RelayRpcRequest {
    return {
        jsonrpc: '2.0',
        id: uuidv4(),
        method,
        params,
    };
}
export function parseRelayMessage(data: string): z.infer<typeof relayMessageSchema> {
    const parsed = JSON.parse(data);
    return relayMessageSchema.parse(parsed);
}

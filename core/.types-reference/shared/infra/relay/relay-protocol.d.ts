import { z } from 'zod';
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
export declare const relayRpcResponseSchema: z.ZodObject<{
    jsonrpc: z.ZodLiteral<"2.0">;
    id: z.ZodString;
    result: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodNumber;
        message: z.ZodString;
        data: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        code: number;
        data?: unknown;
    }, {
        message: string;
        code: number;
        data?: unknown;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    jsonrpc: "2.0";
    error?: {
        message: string;
        code: number;
        data?: unknown;
    } | undefined;
    result?: unknown;
}, {
    id: string;
    jsonrpc: "2.0";
    error?: {
        message: string;
        code: number;
        data?: unknown;
    } | undefined;
    result?: unknown;
}>;
export declare const relayHeartbeatSchema: z.ZodObject<{
    type: z.ZodLiteral<"heartbeat">;
    relayId: z.ZodString;
    tenantId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    type: "heartbeat";
    relayId: string;
}, {
    tenantId: string;
    type: "heartbeat";
    relayId: string;
}>;
export declare const relayResourceUpdateSchema: z.ZodObject<{
    type: z.ZodLiteral<"resource_update">;
    relayId: z.ZodString;
    tenantId: z.ZodString;
    resources: z.ZodArray<z.ZodObject<{
        resourceId: z.ZodString;
        type: z.ZodEnum<["postgres", "mongodb"]>;
        name: z.ZodString;
        database: z.ZodString;
        readOnly: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        type: "postgres" | "mongodb";
        database: string;
        name: string;
        resourceId: string;
        readOnly: boolean;
    }, {
        type: "postgres" | "mongodb";
        database: string;
        name: string;
        resourceId: string;
        readOnly: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    type: "resource_update";
    resources: {
        type: "postgres" | "mongodb";
        database: string;
        name: string;
        resourceId: string;
        readOnly: boolean;
    }[];
    relayId: string;
}, {
    tenantId: string;
    type: "resource_update";
    resources: {
        type: "postgres" | "mongodb";
        database: string;
        name: string;
        resourceId: string;
        readOnly: boolean;
    }[];
    relayId: string;
}>;
export declare const relayMessageSchema: z.ZodUnion<[z.ZodObject<{
    jsonrpc: z.ZodLiteral<"2.0">;
    id: z.ZodString;
    result: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodNumber;
        message: z.ZodString;
        data: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        code: number;
        data?: unknown;
    }, {
        message: string;
        code: number;
        data?: unknown;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    jsonrpc: "2.0";
    error?: {
        message: string;
        code: number;
        data?: unknown;
    } | undefined;
    result?: unknown;
}, {
    id: string;
    jsonrpc: "2.0";
    error?: {
        message: string;
        code: number;
        data?: unknown;
    } | undefined;
    result?: unknown;
}>, z.ZodObject<{
    type: z.ZodLiteral<"heartbeat">;
    relayId: z.ZodString;
    tenantId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    type: "heartbeat";
    relayId: string;
}, {
    tenantId: string;
    type: "heartbeat";
    relayId: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"resource_update">;
    relayId: z.ZodString;
    tenantId: z.ZodString;
    resources: z.ZodArray<z.ZodObject<{
        resourceId: z.ZodString;
        type: z.ZodEnum<["postgres", "mongodb"]>;
        name: z.ZodString;
        database: z.ZodString;
        readOnly: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        type: "postgres" | "mongodb";
        database: string;
        name: string;
        resourceId: string;
        readOnly: boolean;
    }, {
        type: "postgres" | "mongodb";
        database: string;
        name: string;
        resourceId: string;
        readOnly: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    type: "resource_update";
    resources: {
        type: "postgres" | "mongodb";
        database: string;
        name: string;
        resourceId: string;
        readOnly: boolean;
    }[];
    relayId: string;
}, {
    tenantId: string;
    type: "resource_update";
    resources: {
        type: "postgres" | "mongodb";
        database: string;
        name: string;
        resourceId: string;
        readOnly: boolean;
    }[];
    relayId: string;
}>]>;
export declare function createRpcRequest(method: RelayRpcMethod, params: Record<string, unknown>): RelayRpcRequest;
export declare function parseRelayMessage(data: string): z.infer<typeof relayMessageSchema>;

import { v4 as uuidv4 } from 'uuid';

export type RpcMethod = 'execute' | 'health_check' | 'list_resources' | 'describe_resource';

export interface RpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: RpcMethod;
  params: Record<string, unknown>;
}

export interface RpcResponse {
  jsonrpc: '2.0';
  id: string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export function createResponse(id: string, result: unknown): RpcResponse {
  return { jsonrpc: '2.0', id, result };
}

export function createErrorResponse(id: string, code: number, message: string, data?: unknown): RpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, data } };
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  relayId: string;
  tenantId: string;
}

export interface ResourceUpdateMessage {
  type: 'resource_update';
  relayId: string;
  tenantId: string;
  resources: Array<{
    resourceId: string;
    type: 'postgres' | 'mongodb';
    name: string;
    database: string;
    readOnly: boolean;
  }>;
}

export function createHeartbeat(relayId: string, tenantId: string): HeartbeatMessage {
  return { type: 'heartbeat', relayId, tenantId };
}

export function createResourceUpdate(
  relayId: string,
  tenantId: string,
  resources: ResourceUpdateMessage['resources'],
): ResourceUpdateMessage {
  return { type: 'resource_update', relayId, tenantId, resources };
}

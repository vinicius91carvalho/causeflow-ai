export type RpcMethod = 'execute' | 'health_check' | 'list_resources' | 'describe_resource';

export interface RpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: RpcMethod;
  params: Record<string, unknown>;
  nonce?: string;
  issuedAt?: number;
}

export interface RpcResponse {
  jsonrpc: '2.0';
  id: string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  signature?: string;
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
  timestamp: number;
}

export interface ResourceUpdateMessage {
  type: 'resource_update';
  relayId: string;
  tenantId: string;
  resources: Array<{
    resourceId: string;
    type: string;
    name: string;
    database: string;
    readOnly: boolean;
    capabilities?: string[];
  }>;
}

export function createHeartbeat(relayId: string, tenantId: string): HeartbeatMessage {
  return { type: 'heartbeat', relayId, tenantId, timestamp: Date.now() };
}

export function createResourceUpdate(
  relayId: string,
  tenantId: string,
  resources: ResourceUpdateMessage['resources'],
): ResourceUpdateMessage {
  return { type: 'resource_update', relayId, tenantId, resources };
}

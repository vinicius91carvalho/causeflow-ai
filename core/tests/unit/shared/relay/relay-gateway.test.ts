import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WssRelayGateway } from '../../../../src/shared/infra/relay/relay-gateway.js';
import { RelayRegistry } from '../../../../src/shared/infra/relay/relay-registry.js';
import type { TenantId } from '../../../../src/shared/domain/value-objects.js';
import type { WebSocket } from 'ws';

type EventListener = (...args: unknown[]) => unknown;

interface MockWebSocket {
  readyState: number;
  on: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  _emit(event: string, data: unknown): void;
}

function createMockWs(): MockWebSocket {
  const listeners: Map<string, EventListener[]> = new Map();
  return {
    readyState: 1,
    on: vi.fn((event: string, fn: EventListener) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(fn);
    }),
    removeListener: vi.fn((event: string, fn: EventListener) => {
      const fns = listeners.get(event);
      if (fns) {
        const idx = fns.indexOf(fn);
        if (idx !== -1) fns.splice(idx, 1);
      }
    }),
    send: vi.fn(),
    close: vi.fn(),
    // Helper to simulate incoming message
    _emit(event: string, data: unknown) {
      for (const fn of listeners.get(event) ?? []) {
        fn(data);
      }
    },
  };
}

describe('WssRelayGateway', () => {
  let registry: RelayRegistry;
  let gateway: WssRelayGateway;
  const tenantId = 'test-tenant' as TenantId;

  beforeEach(() => {
    registry = new RelayRegistry();
    gateway = new WssRelayGateway(registry, 5_000);
  });

  afterEach(() => {
    registry.shutdown();
  });

  it('isConnected delegates to registry', () => {
    expect(gateway.isConnected(tenantId)).toBe(false);
    const ws = createMockWs();
    registry.register('test-tenant', 'relay-1', ws as unknown as WebSocket);
    expect(gateway.isConnected(tenantId)).toBe(true);
  });

  it('listResources returns cached resources when available', async () => {
    const ws = createMockWs();
    registry.register('test-tenant', 'relay-1', ws as unknown as WebSocket);
    registry.updateResources('test-tenant', 'relay-1', [
      { resourceId: 'pg-1', type: 'postgres', name: 'PG', database: 'test', readOnly: true },
    ]);

    const resources = await gateway.listResources(tenantId);
    expect(resources).toHaveLength(1);
    expect(resources[0]!.resourceId).toBe('pg-1');
    // Should NOT have sent an RPC since we had cached resources
    expect(ws.send).not.toHaveBeenCalled();
  });

  it('throws when no relay connected', async () => {
    await expect(gateway.listResources(tenantId)).rejects.toThrow('No relay connected');
  });

  it('execute sends JSON-RPC and resolves on response', async () => {
    const ws = createMockWs();
    registry.register('test-tenant', 'relay-1', ws as unknown as WebSocket);

    // Intercept the send to get the request ID and simulate response
    ws.send.mockImplementation((data: string) => {
      const req = JSON.parse(data);
      // Simulate async response
      setTimeout(() => {
        ws._emit('message', JSON.stringify({
          jsonrpc: '2.0',
          id: req.id,
          result: { rows: [{ id: 1 }], rowCount: 1, executionTimeMs: 5, masked: false, maskedFieldCount: 0 },
        }));
      }, 10);
    });

    const result = await gateway.execute(tenantId, {
      resourceId: 'pg-1',
      operation: 'query',
      params: { sql: 'SELECT 1' },
    });

    expect(result).toBeDefined();
    expect((result as any).rows).toHaveLength(1);
  });

  it('execute rejects on RPC error response', async () => {
    const ws = createMockWs();
    registry.register('test-tenant', 'relay-1', ws as unknown as WebSocket);

    ws.send.mockImplementation((data: string) => {
      const req = JSON.parse(data);
      setTimeout(() => {
        ws._emit('message', JSON.stringify({
          jsonrpc: '2.0',
          id: req.id,
          error: { code: -32600, message: 'Policy denied: query not allowed' },
        }));
      }, 10);
    });

    await expect(gateway.execute(tenantId, {
      resourceId: 'pg-1',
      operation: 'query',
      params: { sql: 'DROP TABLE users' },
    })).rejects.toThrow('Policy denied');
  });

  it('execute rejects on timeout', async () => {
    const ws = createMockWs();
    registry.register('test-tenant', 'relay-1', ws as unknown as WebSocket);

    // Use very short timeout
    const fastGateway = new WssRelayGateway(registry, 100);

    // Don't simulate any response — should timeout
    await expect(fastGateway.execute(tenantId, {
      resourceId: 'pg-1',
      operation: 'query',
      params: { sql: 'SELECT 1' },
    })).rejects.toThrow('timeout');
  });
});

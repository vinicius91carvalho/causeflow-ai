import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RelayRegistry } from '../../../../src/shared/infra/relay/relay-registry.js';
import type { WebSocket } from 'ws';

function createMockWs() {
  return {
    on: vi.fn(),
    close: vi.fn(),
    send: vi.fn(),
    removeListener: vi.fn(),
    readyState: 1,
  } as unknown as WebSocket;
}

describe('RelayRegistry', () => {
  let registry: RelayRegistry;

  beforeEach(() => {
    registry = new RelayRegistry();
  });

  afterEach(() => {
    registry.shutdown();
  });

  it('registers and finds a relay connection', () => {
    const ws = createMockWs();
    registry.register('tenant-1', 'relay-1', ws);
    expect(registry.isConnected('tenant-1')).toBe(true);
  });

  it('returns false for unconnected tenant', () => {
    expect(registry.isConnected('nonexistent')).toBe(false);
  });

  it('unregisters a relay connection', () => {
    const ws = createMockWs();
    registry.register('tenant-1', 'relay-1', ws);
    registry.unregister('tenant-1', 'relay-1');
    expect(registry.isConnected('tenant-1')).toBe(false);
  });

  it('getForTenant returns the connection', () => {
    const ws = createMockWs();
    registry.register('tenant-1', 'relay-1', ws);
    const conn = registry.getForTenant('tenant-1');
    expect(conn).toBeDefined();
    expect(conn!.relayId).toBe('relay-1');
    expect(conn!.tenantId).toBe('tenant-1');
    expect(conn!.ws).toBe(ws);
  });

  it('returns undefined for nonexistent tenant', () => {
    expect(registry.getForTenant('nonexistent')).toBeUndefined();
  });

  it('updateHeartbeat updates lastHeartbeat', () => {
    const ws = createMockWs();
    registry.register('tenant-1', 'relay-1', ws);
    const before = registry.getForTenant('tenant-1')!.lastHeartbeat;
    // Wait a tick
    const later = before + 1000;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    registry.updateHeartbeat('tenant-1', 'relay-1');
    expect(registry.getForTenant('tenant-1')!.lastHeartbeat).toBe(later);
    vi.restoreAllMocks();
  });

  it('updateResources stores resource list', () => {
    const ws = createMockWs();
    registry.register('tenant-1', 'relay-1', ws);
    const resources = [
      { resourceId: 'pg-1', type: 'postgres' as const, name: 'PG', database: 'test', readOnly: true },
    ];
    registry.updateResources('tenant-1', 'relay-1', resources);
    expect(registry.getForTenant('tenant-1')!.resources).toEqual(resources);
  });

  it('shutdown closes all connections', () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();
    registry.register('tenant-1', 'relay-1', ws1);
    registry.register('tenant-2', 'relay-2', ws2);
    registry.shutdown();
    expect(ws1.close).toHaveBeenCalled();
    expect(ws2.close).toHaveBeenCalled();
    expect(registry.isConnected('tenant-1')).toBe(false);
    expect(registry.isConnected('tenant-2')).toBe(false);
  });
});

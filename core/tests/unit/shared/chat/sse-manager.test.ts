import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SSEManager } from '../../../../src/shared/infra/chat/sse-manager.js';
import type { SSEStreamingApi } from 'hono/streaming';

function createMockStream(): SSEStreamingApi {
  return {
    writeSSE: vi.fn(),
  } as unknown as SSEStreamingApi;
}

describe('SSEManager', () => {
  let manager: SSEManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new SSEManager();
  });

  afterEach(() => {
    manager.shutdown();
    vi.useRealTimers();
  });

  it('should add a client and track by tenant', () => {
    const stream = createMockStream();

    manager.addClient('tenant-1', 'client-1', stream);

    expect(manager.getClientCount('tenant-1')).toBe(1);
    expect(manager.getClientCount()).toBe(1);
  });

  it('should remove a client', () => {
    const stream = createMockStream();
    manager.addClient('tenant-1', 'client-1', stream);
    manager.addClient('tenant-1', 'client-2', createMockStream());

    manager.removeClient('tenant-1', 'client-1');

    expect(manager.getClientCount('tenant-1')).toBe(1);
  });

  it('should remove tenant map when last client disconnects', () => {
    const stream = createMockStream();
    manager.addClient('tenant-1', 'client-1', stream);

    manager.removeClient('tenant-1', 'client-1');

    expect(manager.getClientCount('tenant-1')).toBe(0);
    expect(manager.getClientCount()).toBe(0);
  });

  it('should broadcast event to all clients of a tenant', async () => {
    const stream1 = createMockStream();
    const stream2 = createMockStream();
    const otherStream = createMockStream();

    manager.addClient('tenant-1', 'client-1', stream1);
    manager.addClient('tenant-1', 'client-2', stream2);
    manager.addClient('tenant-2', 'client-3', otherStream);

    await manager.broadcast('tenant-1', {
      event: 'notification',
      data: { message: 'hello' },
      id: 'evt-1',
    });

    expect(stream1.writeSSE).toHaveBeenCalledWith({
      event: 'notification',
      data: JSON.stringify({ message: 'hello' }),
      id: 'evt-1',
    });
    expect(stream2.writeSSE).toHaveBeenCalledWith({
      event: 'notification',
      data: JSON.stringify({ message: 'hello' }),
      id: 'evt-1',
    });
    expect(otherStream.writeSSE).not.toHaveBeenCalled();
  });

  it('should return total client count across all tenants', () => {
    manager.addClient('tenant-1', 'client-1', createMockStream());
    manager.addClient('tenant-1', 'client-2', createMockStream());
    manager.addClient('tenant-2', 'client-3', createMockStream());

    expect(manager.getClientCount()).toBe(3);
    expect(manager.getClientCount('tenant-1')).toBe(2);
    expect(manager.getClientCount('tenant-2')).toBe(1);
    expect(manager.getClientCount('tenant-3')).toBe(0);
  });

  it('should remove dead clients when broadcast fails', async () => {
    const healthyStream = createMockStream();
    const deadStream = createMockStream();
    vi.mocked(deadStream.writeSSE).mockRejectedValueOnce(new Error('connection closed'));

    manager.addClient('tenant-1', 'healthy', healthyStream);
    manager.addClient('tenant-1', 'dead', deadStream);

    await manager.broadcast('tenant-1', {
      event: 'notification',
      data: { message: 'test' },
    });

    expect(manager.getClientCount('tenant-1')).toBe(1);
  });

  it('should buffer incident events for SSE replay even without connected clients', async () => {
    await manager.broadcast('tenant-1', {
      event: 'investigation_progress',
      data: { incidentId: 'inc-1', stage: 'agent_failed', agentRole: 'log_analyst' },
    });

    expect(manager.getIncidentReplayEvents('tenant-1', 'inc-1')).toEqual([
      {
        event: 'investigation_progress',
        data: { incidentId: 'inc-1', stage: 'agent_failed', agentRole: 'log_analyst' },
      },
    ]);
  });

  it('should replay buffered incident events to late SSE subscribers', async () => {
    await manager.broadcast('tenant-1', {
      event: 'investigation_progress',
      data: { incidentId: 'inc-2', stage: 'agent_failed', agentRole: 'metric_analyst' },
    });

    const stream = createMockStream();
    manager.addClient('tenant-1', 'late-client', stream);

    const replay = manager.getIncidentReplayEvents('tenant-1', 'inc-2');
    expect(replay).toHaveLength(1);
    expect(replay[0]?.data.agentRole).toBe('metric_analyst');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../../src/shared/domain/events.js';
import type { DomainEvent } from '../../../src/shared/domain/events.js';

describe('EventBus', () => {
  it('should publish events to subscribed handlers', async () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.subscribe('test.event', handler);

    const event: DomainEvent = {
      eventType: 'test.event',
      occurredAt: new Date().toISOString(),
      tenantId: 'tenant-1',
      payload: { key: 'value' },
    };

    await bus.publish(event);

    expect(handler).toHaveBeenCalledWith(event);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not call handler for different event type', async () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.subscribe('test.event', handler);

    await bus.publish({
      eventType: 'other.event',
      occurredAt: new Date().toISOString(),
      tenantId: 'tenant-1',
      payload: {},
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should support multiple handlers for same event', async () => {
    const bus = new EventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    bus.subscribe('test.event', handler1);
    bus.subscribe('test.event', handler2);

    await bus.publish({
      eventType: 'test.event',
      occurredAt: new Date().toISOString(),
      tenantId: 'tenant-1',
      payload: {},
    });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe handler', async () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.subscribe('test.event', handler);
    bus.unsubscribe('test.event', handler);

    await bus.publish({
      eventType: 'test.event',
      occurredAt: new Date().toISOString(),
      tenantId: 'tenant-1',
      payload: {},
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should not throw if handler fails', async () => {
    const bus = new EventBus();
    const failingHandler = vi.fn().mockRejectedValue(new Error('handler error'));
    const successHandler = vi.fn();

    bus.subscribe('test.event', failingHandler);
    bus.subscribe('test.event', successHandler);

    await expect(
      bus.publish({
        eventType: 'test.event',
        occurredAt: new Date().toISOString(),
        tenantId: 'tenant-1',
        payload: {},
      }),
    ).resolves.toBeUndefined();

    expect(successHandler).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/shared/infra/queue/sqs-client.js', () => ({
  receiveMessages: vi.fn(),
  deleteMessage: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock('../../../../src/shared/infra/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

import { createSQSConsumer } from '../../../../src/shared/infra/queue/sqs-consumer.js';
import { receiveMessages, deleteMessage } from '../../../../src/shared/infra/queue/sqs-client.js';

describe('SQS Consumer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should receive message, call handler, and delete on success', async () => {
    const handler = vi.fn(async () => {});
    const controller = new AbortController();

    vi.mocked(receiveMessages)
      .mockResolvedValueOnce([
        { MessageId: 'msg-1', Body: '{"test": true}', ReceiptHandle: 'rh-1' },
      ])
      .mockImplementation(async () => {
        controller.abort();
        return [];
      });

    vi.mocked(deleteMessage).mockResolvedValue(undefined);

    const consumer = createSQSConsumer({
      queueUrl: 'http://localhost:4566/queue/test',
      handler,
      signal: controller.signal,
    });

    await consumer.start();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ MessageId: 'msg-1', Body: '{"test": true}' }),
    );
    expect(deleteMessage).toHaveBeenCalledWith(
      'http://localhost:4566/queue/test',
      'rh-1',
    );
  });

  it('should not delete message when handler throws', async () => {
    const handler = vi.fn(async () => {
      throw new Error('Processing failed');
    });
    const controller = new AbortController();

    vi.mocked(receiveMessages)
      .mockResolvedValueOnce([
        { MessageId: 'msg-2', Body: '{"test": true}', ReceiptHandle: 'rh-2' },
      ])
      .mockImplementation(async () => {
        controller.abort();
        return [];
      });

    const consumer = createSQSConsumer({
      queueUrl: 'http://localhost:4566/queue/test',
      handler,
      signal: controller.signal,
    });

    await consumer.start();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(deleteMessage).not.toHaveBeenCalled();
  });

  it('should stop polling when signal is aborted', async () => {
    const handler = vi.fn();
    const controller = new AbortController();

    vi.mocked(receiveMessages).mockImplementation(async () => {
      controller.abort();
      return [];
    });

    const consumer = createSQSConsumer({
      queueUrl: 'http://localhost:4566/queue/test',
      handler,
      signal: controller.signal,
    });

    await consumer.start();

    expect(handler).not.toHaveBeenCalled();
    expect(receiveMessages).toHaveBeenCalledTimes(1);
  });

  it('should process multiple messages in a batch', async () => {
    const handler = vi.fn(async () => {});
    const controller = new AbortController();

    vi.mocked(receiveMessages)
      .mockResolvedValueOnce([
        { MessageId: 'msg-1', Body: '{"n": 1}', ReceiptHandle: 'rh-1' },
        { MessageId: 'msg-2', Body: '{"n": 2}', ReceiptHandle: 'rh-2' },
        { MessageId: 'msg-3', Body: '{"n": 3}', ReceiptHandle: 'rh-3' },
      ])
      .mockImplementation(async () => {
        controller.abort();
        return [];
      });

    vi.mocked(deleteMessage).mockResolvedValue(undefined);

    const consumer = createSQSConsumer({
      queueUrl: 'http://localhost:4566/queue/test',
      handler,
      signal: controller.signal,
    });

    await consumer.start();

    expect(handler).toHaveBeenCalledTimes(3);
    expect(deleteMessage).toHaveBeenCalledTimes(3);
  });
});

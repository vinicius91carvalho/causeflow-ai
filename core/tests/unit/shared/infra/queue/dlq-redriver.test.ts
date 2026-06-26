import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../../src/shared/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const mockReceiveMessages = vi.fn();
const mockDeleteMessage = vi.fn();
const mockSendMessage = vi.fn();

vi.mock('../../../../../src/shared/infra/queue/sqs-client.js', () => ({
  receiveMessages: (...args: unknown[]) => mockReceiveMessages(...args),
  deleteMessage: (...args: unknown[]) => mockDeleteMessage(...args),
  sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}));

import { redriveDLQ } from '../../../../../src/shared/infra/queue/dlq-redriver.js';

describe('redriveDLQ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReceiveMessages.mockResolvedValue([]);
    mockDeleteMessage.mockResolvedValue(undefined);
    mockSendMessage.mockResolvedValue(undefined);
  });

  it('should move messages from DLQ to target queue', async () => {
    mockReceiveMessages.mockResolvedValue([
      { MessageId: 'msg-1', Body: '{"type":"alert","id":"1"}', ReceiptHandle: 'rh-1' },
      { MessageId: 'msg-2', Body: '{"type":"alert","id":"2"}', ReceiptHandle: 'rh-2' },
    ]);

    const result = await redriveDLQ('dlq-url', 'target-url', 10);

    expect(result.moved).toBe(2);
    expect(result.failed).toBe(0);
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    expect(mockSendMessage).toHaveBeenCalledWith('target-url', { type: 'alert', id: '1' });
    expect(mockDeleteMessage).toHaveBeenCalledTimes(2);
    expect(mockDeleteMessage).toHaveBeenCalledWith('dlq-url', 'rh-1');
  });

  it('should return zeros when DLQ is empty', async () => {
    mockReceiveMessages.mockResolvedValue([]);

    const result = await redriveDLQ('dlq-url', 'target-url');

    expect(result.moved).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('should count failures when sendMessage throws', async () => {
    mockReceiveMessages.mockResolvedValue([
      { MessageId: 'msg-1', Body: '{"type":"alert"}', ReceiptHandle: 'rh-1' },
    ]);
    mockSendMessage.mockRejectedValue(new Error('SQS error'));

    const result = await redriveDLQ('dlq-url', 'target-url');

    expect(result.moved).toBe(0);
    expect(result.failed).toBe(1);
    expect(mockDeleteMessage).not.toHaveBeenCalled();
  });

  it('should pass limit to receiveMessages', async () => {
    mockReceiveMessages.mockResolvedValue([]);

    await redriveDLQ('dlq-url', 'target-url', 5);

    expect(mockReceiveMessages).toHaveBeenCalledWith('dlq-url', {
      maxMessages: 5,
      waitTimeSeconds: 1,
    });
  });

  it('should use default limit of 10', async () => {
    mockReceiveMessages.mockResolvedValue([]);

    await redriveDLQ('dlq-url', 'target-url');

    expect(mockReceiveMessages).toHaveBeenCalledWith('dlq-url', {
      maxMessages: 10,
      waitTimeSeconds: 1,
    });
  });

  it('should handle messages without ReceiptHandle', async () => {
    mockReceiveMessages.mockResolvedValue([
      { MessageId: 'msg-1', Body: '{"type":"alert"}' },
    ]);

    const result = await redriveDLQ('dlq-url', 'target-url');

    expect(result.moved).toBe(1);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockDeleteMessage).not.toHaveBeenCalled();
  });

  it('should handle invalid JSON body gracefully', async () => {
    mockReceiveMessages.mockResolvedValue([
      { MessageId: 'msg-1', Body: 'not-json', ReceiptHandle: 'rh-1' },
    ]);

    const result = await redriveDLQ('dlq-url', 'target-url');

    expect(result.failed).toBe(1);
    expect(result.moved).toBe(0);
  });
});

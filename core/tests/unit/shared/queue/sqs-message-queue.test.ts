import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SQSMessageQueue } from '../../../../src/shared/infra/queue/sqs-message-queue.js';

vi.mock('../../../../src/shared/infra/queue/sqs-client.js', () => ({
  sendMessage: vi.fn(async () => {}),
}));

describe('SQSMessageQueue', () => {
  let messageQueue: SQSMessageQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    messageQueue = new SQSMessageQueue();
  });

  it('should delegate send to sqs-client sendMessage', async () => {
    const { sendMessage } = await import('../../../../src/shared/infra/queue/sqs-client.js');

    await messageQueue.send('http://localhost:4566/queue/test', { foo: 'bar' });

    expect(sendMessage).toHaveBeenCalledWith('http://localhost:4566/queue/test', { foo: 'bar' });
  });

  it('should propagate errors from sqs-client', async () => {
    const { sendMessage } = await import('../../../../src/shared/infra/queue/sqs-client.js');
    vi.mocked(sendMessage).mockRejectedValueOnce(new Error('SQS unavailable'));

    await expect(
      messageQueue.send('http://localhost:4566/queue/test', { fail: true }),
    ).rejects.toThrow('SQS unavailable');
  });

  it('should implement MessageQueue interface', () => {
    expect(messageQueue.send).toBeDefined();
    expect(typeof messageQueue.send).toBe('function');
  });
});

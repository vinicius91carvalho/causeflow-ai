import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SQSClient } from '@aws-sdk/client-sqs';
import {
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  PurgeQueueCommand,
} from '@aws-sdk/client-sqs';
import { getSQSClient, waitForSQS } from './setup.js';

describe('SQS Integration', () => {
  let client: SQSClient;
  let alertQueueUrl: string;
  let alertDlqUrl: string;

  beforeAll(async () => {
    client = getSQSClient();
    alertQueueUrl = await waitForSQS(client, 'causeflow-alerts');
    alertDlqUrl = await waitForSQS(client, 'causeflow-alerts-dlq');

    // Purge queues to start clean
    try {
      await client.send(new PurgeQueueCommand({ QueueUrl: alertQueueUrl }));
      await client.send(new PurgeQueueCommand({ QueueUrl: alertDlqUrl }));
    } catch {
      // PurgeQueue may fail if recently purged
    }
    // Wait for purge to take effect (ministack latency)
    await new Promise((r) => setTimeout(r, 2000));
  });

  afterAll(() => {
    client.destroy();
  });

  it('should send and receive a message', async () => {
    const body = { incidentId: 'inc-test-1', tenantId: 'tenant-test', severity: 'critical' };

    await client.send(new SendMessageCommand({
      QueueUrl: alertQueueUrl,
      MessageBody: JSON.stringify(body),
    }));

    const result = await client.send(new ReceiveMessageCommand({
      QueueUrl: alertQueueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 5,
    }));

    expect(result.Messages).toBeDefined();
    expect(result.Messages!.length).toBe(1);
    const parsed = JSON.parse(result.Messages![0]!.Body!);
    expect(parsed.incidentId).toBe('inc-test-1');
    expect(parsed.severity).toBe('critical');

    // Delete the message
    await client.send(new DeleteMessageCommand({
      QueueUrl: alertQueueUrl,
      ReceiptHandle: result.Messages![0]!.ReceiptHandle!,
    }));
  });

  it('should send multiple messages and receive in batch', async () => {
    const messages = Array.from({ length: 5 }, (_, i) => ({
      incidentId: `inc-batch-${i}`,
      tenantId: 'tenant-test',
    }));

    for (const msg of messages) {
      await client.send(new SendMessageCommand({
        QueueUrl: alertQueueUrl,
        MessageBody: JSON.stringify(msg),
      }));
    }

    const allMessages: string[] = [];
    let attempts = 0;

    while (allMessages.length < 5 && attempts < 5) {
      const result = await client.send(new ReceiveMessageCommand({
        QueueUrl: alertQueueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 3,
      }));

      for (const msg of result.Messages ?? []) {
        allMessages.push(msg.Body!);
        await client.send(new DeleteMessageCommand({
          QueueUrl: alertQueueUrl,
          ReceiptHandle: msg.ReceiptHandle!,
        }));
      }
      attempts++;
    }

    expect(allMessages.length).toBe(5);
  });

  it('should get queue attributes', async () => {
    const result = await client.send(new GetQueueAttributesCommand({
      QueueUrl: alertQueueUrl,
      AttributeNames: ['ApproximateNumberOfMessages', 'VisibilityTimeout'],
    }));

    expect(result.Attributes).toBeDefined();
    expect(result.Attributes!['VisibilityTimeout']).toBe('300');
  });

  it('should verify investigation queue has correct visibility timeout', async () => {
    const invQueueUrl = await waitForSQS(client, 'causeflow-investigation');
    const result = await client.send(new GetQueueAttributesCommand({
      QueueUrl: invQueueUrl,
      AttributeNames: ['VisibilityTimeout'],
    }));

    expect(result.Attributes!['VisibilityTimeout']).toBe('900');
  });

  it('should verify remediation queue has correct visibility timeout', async () => {
    const remQueueUrl = await waitForSQS(client, 'causeflow-remediation');
    const result = await client.send(new GetQueueAttributesCommand({
      QueueUrl: remQueueUrl,
      AttributeNames: ['VisibilityTimeout'],
    }));

    expect(result.Attributes!['VisibilityTimeout']).toBe('600');
  });

  it('should verify all 6 queues exist (3 main + 3 DLQ)', async () => {
    const queueNames = [
      'causeflow-alerts',
      'causeflow-alerts-dlq',
      'causeflow-investigation',
      'causeflow-investigation-dlq',
      'causeflow-remediation',
      'causeflow-remediation-dlq',
    ];

    for (const name of queueNames) {
      const url = await waitForSQS(client, name);
      expect(url).toContain(name);
    }
  });
});

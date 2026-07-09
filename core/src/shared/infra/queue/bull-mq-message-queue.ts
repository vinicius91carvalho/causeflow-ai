/**
 * BullMQ implementation of the MessageQueue port.
 *
 * In the open-source local runtime (AC-041), BullMQ on Redis replaces SQS.
 * The `send(queueUrl, body)` method interprets `queueUrl` as a BullMQ queue
 * name (e.g. `causeflow-triage`) and adds a job to that queue.
 *
 * Queue instances are cached per name so the same Queue object is reused
 * across calls (avoids redundant CREATE / client registrations).
 */
import { Queue } from 'bullmq';
import { asBullConnection } from './bull-mq-connection.js';
import { logger } from '../logger.js';

export class BullMqMessageQueue {
  private queues = new Map<string, Queue>();

  private getQueue(queueName: string): Queue {
    let q = this.queues.get(queueName);
    if (!q) {
      q = new Queue(queueName, {
        connection: asBullConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
        },
      });
      this.queues.set(queueName, q);
      logger.debug({ queueName }, 'BullMQ queue initialised');
    }
    return q;
  }

  async send(queueName: string, body: Record<string, unknown>): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.add('job', body, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
    logger.debug({ queueName, body }, 'BullMQ job enqueued');
  }

  async close(): Promise<void> {
    for (const [name, q] of this.queues) {
      try {
        await q.close();
        logger.debug({ queueName: name }, 'BullMQ queue closed');
      } catch (err) {
        logger.warn({ err, queueName: name }, 'Error closing BullMQ queue');
      }
    }
    this.queues.clear();
  }

  /** Return the list of queue names that have been accessed. */
  getKnownQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }
}

/**
 * BullMQ worker factory.
 *
 * Creates a Worker that processes jobs from a named queue.
 * Returns a ConsumerHandle-compatible object so the lifecycle manager
 * can stop it gracefully.
 */
import { Worker, type Job } from 'bullmq';
import { asBullConnection } from './bull-mq-connection.js';
import { logger } from '../logger.js';

export interface BullWorkerOptions {
  /** BullMQ queue name to consume from. */
  queueName: string;
  /** Handler called for each job. Receives the parsed job body. */
  handler: (body: Record<string, unknown>) => Promise<void>;
  /** Number of concurrent jobs this worker processes (default 1). */
  concurrency?: number;
}

export interface BullWorkerHandle {
  /** Stop the worker. Waits for in-flight jobs to complete. */
  stop: () => Promise<void>;
  /** The underlying Worker instance (for status inspection). */
  worker: Worker;
}

export function createBullWorker(options: BullWorkerOptions): BullWorkerHandle {
  const worker = new Worker(
    options.queueName,
    async (job) => {
      const body = job.data as Record<string, unknown>;
      await options.handler(body);
    },
    {
      connection: asBullConnection(),
      concurrency: options.concurrency ?? 1,
    },
  );

  worker.on('completed', (job: Job) => {
    logger.info({ queueName: options.queueName, jobId: job.id }, 'BullMQ job completed');
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error(
      { queueName: options.queueName, jobId: job?.id, err: err.message },
      'BullMQ job failed',
    );
  });

  worker.on('error', (err: Error) => {
    logger.error({ err: err.message, queueName: options.queueName }, 'BullMQ worker error');
  });

  logger.info(
    { queueName: options.queueName, concurrency: options.concurrency ?? 1 },
    'BullMQ worker started',
  );

  return {
    stop: async () => {
      logger.info({ queueName: options.queueName }, 'BullMQ worker stopping');
      await worker.close();
    },
    worker,
  };
}

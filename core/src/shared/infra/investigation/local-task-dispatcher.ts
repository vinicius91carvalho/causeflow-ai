/**
 * LocalInvestigationTaskDispatcher — OSS local runtime dispatch.
 *
 * In the open-source local runtime (AC-045), this replaces the ECS-based
 * investigation task dispatcher. Instead of launching a Fargate task, it
 * enqueues a job to the BullMQ investigation queue, which the long-lived
 * `causeflow-worker` docker-compose service picks up.
 *
 * No ECS client, no AWS credentials — only BullMQ on the local Redis.
 */
import { Queue } from 'bullmq';
import { asBullConnection } from '../queue/bull-mq-connection.js';
import { config } from '../../config/index.js';
import { logger } from '../logger.js';

export interface DispatchInvestigationParams {
  incidentId: string;
  tenantId: string;
  suggestedAgents: string[];
  /** Worker mode: 'investigate' (default) or 'followup' (skip investigation, enter idle for Q&A) */
  mode?: 'investigate' | 'followup';
}

let queue: Queue | null = null;

function getQueue(): Queue {
  if (!queue) {
    queue = new Queue(config.bullmq.investigationQueueName, {
      connection: asBullConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
    logger.debug(
      { queueName: config.bullmq.investigationQueueName },
      'LocalInvestigationTaskDispatcher: BullMQ queue initialised',
    );
  }
  return queue;
}

/**
 * Enqueue an investigation job to the BullMQ investigation queue.
 * The `causeflow-worker` BullMQ consumer picks it up and runs the
 * investigation (or enters followup mode if `mode === 'followup'`).
 *
 * @returns The job ID as a string, or `undefined` if enqueueing failed.
 */
export async function dispatchInvestigation(
  params: DispatchInvestigationParams,
): Promise<string | undefined> {
  logger.info(
    {
      incidentId: params.incidentId,
      tenantId: params.tenantId,
      agentCount: params.suggestedAgents.length,
      mode: params.mode ?? 'investigate',
    },
    'LocalInvestigationTaskDispatcher: enqueuing investigation job',
  );

  try {
    const q = getQueue();
    const job = await q.add(
      'investigation',
      {
        tenantId: params.tenantId,
        incidentId: params.incidentId,
        suggestedAgents: params.suggestedAgents,
        mode: params.mode ?? 'investigate',
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
    logger.info(
      { jobId: job.id, incidentId: params.incidentId },
      'LocalInvestigationTaskDispatcher: investigation job enqueued',
    );
    return job.id ?? undefined;
  } catch (err) {
    logger.error(
      { err, incidentId: params.incidentId },
      'LocalInvestigationTaskDispatcher: failed to enqueue investigation job',
    );
    return undefined;
  }
}

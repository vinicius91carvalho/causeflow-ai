/**
 * Admin endpoint for BullMQ queue visibility (AC-041).
 *
 * `GET /admin/queues` returns each queue's name, depth (waiting + active),
 * completed/failed counts, and the last 5 jobs.
 *
 * This is a local-only admin endpoint, bound to the loopback interface
 * or behind VPN in production.
 */
import { Hono } from 'hono';
import { Queue, type Job } from 'bullmq';
import { asBullConnection } from './bull-mq-connection.js';

/** The four queues the platform uses. */
export const BULLMQ_QUEUE_NAMES = [
  'causeflow-alerts',
  'causeflow-triage',
  'causeflow-investigation',
  'causeflow-remediation',
] as const;

export type BullMqQueueName = (typeof BULLMQ_QUEUE_NAMES)[number];

export interface QueueStats {
  name: string;
  depth: number;
  completed: number;
  failed: number;
  lastJobs: Array<{
    id: string | undefined;
    name: string;
    status: 'completed' | 'failed';
    data: Record<string, unknown>;
    timestamp: number | undefined;
  }>;
}

export async function fetchQueueStats(names: readonly string[]): Promise<QueueStats[]> {
  const results: QueueStats[] = [];

  for (const name of names) {
    const queue = new Queue(name, { connection: asBullConnection() });
    try {
      const [counts, completed, failed] = await Promise.all([
        queue.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed'),
        queue.getJobs('completed', 0, 4),
        queue.getJobs('failed', 0, 4),
      ]);

      // Merge and sort by timestamp descending, take last 5
      const allJobs = [
        ...completed.map((j) => ({ job: j, status: 'completed' as const })),
        ...failed.map((j) => ({ job: j, status: 'failed' as const })),
      ];
      allJobs.sort((a, b) => (b.job.timestamp ?? 0) - (a.job.timestamp ?? 0));
      const lastJobs = allJobs
        .slice(0, 5)
        .map(({ job, status }: { job: Job; status: 'completed' | 'failed' }) => ({
          id: job.id,
          name: job.name,
          status,
          data: (job.data ?? {}) as Record<string, unknown>,
          timestamp: job.timestamp,
        }));

      results.push({
        name,
        depth: (counts.wait ?? 0) + (counts.active ?? 0),
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        lastJobs,
      });
    } finally {
      await queue.close();
    }
  }

  return results;
}

/** Hono router for /admin/queues. */
export function createAdminQueueRoutes(): Hono {
  const app = new Hono();

  app.get('/queues', async (c) => {
    const stats = await fetchQueueStats(BULLMQ_QUEUE_NAMES);
    return c.json({ queues: stats });
  });

  return app;
}

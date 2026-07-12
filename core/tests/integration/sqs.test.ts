/**
 * BullMQ/Redis integration test for the OSS runtime (replaces SQS integration).
 *
 * Verifies that BullMQ queues on Redis work correctly for the 4 causeflow
 * queue patterns: alerts, triage, investigation, remediation.
 *
 * Each test uses a unique queue name (suffixed with test index) to avoid
 * cross-test interference.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Job } from 'bullmq';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { waitForRedis } from './setup.js';

function getBullConnection(): Redis {
  return new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6380', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });
}

let globalBullRedis: Redis;

async function ensureBullRedis(): Promise<Redis> {
  if (!globalBullRedis) {
    globalBullRedis = getBullConnection();
    await globalBullRedis.connect();
  }
  return globalBullRedis;
}

/** Unique queue name per test invocation. */
let queueSeq = 0;
function nextQueueName(base: string): string {
  queueSeq++;
  return `test-${base}-${queueSeq}`;
}

/** Poll until the job reaches 'completed' or 'failed' state. */
async function waitForJobEnd(job: Job, timeoutMs: number): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await job.getState();
    if (state === 'completed' || state === 'failed') return state;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(
    `Job did not complete within ${timeoutMs}ms, last state: ${await job.getState()}`,
  );
}

describe('BullMQ/Redis Integration (OSS runtime)', () => {
  beforeAll(async () => {
    await waitForRedis();
  });

  afterAll(async () => {
    if (globalBullRedis) {
      await globalBullRedis.quit().catch(() => {});
    }
  });

  it('should send and process a job', async () => {
    const conn = await ensureBullRedis();
    const qName = nextQueueName('alerts');
    const queue = new Queue(qName, { connection: conn });
    const worker = new Worker(
      qName,
      async (job: Job) => {
        return { processed: true, received: job.data };
      },
      { connection: conn, concurrency: 1 },
    );

    try {
      await new Promise((r) => setTimeout(r, 500));

      const job = await queue.add('job', { incidentId: 'inc-1', severity: 'critical' });
      expect(job.id).toBeDefined();

      const state = await waitForJobEnd(job, 8000);
      expect(state).toBe('completed');
    } finally {
      await worker.close();
      await queue.close();
    }
  });

  it('should process multiple jobs', async () => {
    const conn = await ensureBullRedis();
    const qName = nextQueueName('multi');
    const queue = new Queue(qName, { connection: conn });
    const processed: string[] = [];

    const worker = new Worker(
      qName,
      async (job: Job) => {
        processed.push(job.data.id as string);
        return { ok: true };
      },
      { connection: conn, concurrency: 5 },
    );

    try {
      await new Promise((r) => setTimeout(r, 500));

      const payloads = Array.from({ length: 5 }, (_, i) => ({ id: `job-${i}` }));
      const jobs = await Promise.all(payloads.map((p) => queue.add('job', p)));

      for (const job of jobs) {
        await waitForJobEnd(job, 15000);
      }

      expect(processed.length).toBe(5);
      expect(processed.sort()).toEqual(['job-0', 'job-1', 'job-2', 'job-3', 'job-4']);
    } finally {
      await worker.close();
      await queue.close();
    }
  }, 25000);

  it('should report queue metrics', async () => {
    const conn = await ensureBullRedis();
    const qName = nextQueueName('metrics');
    const queue = new Queue(qName, { connection: conn });

    try {
      const counts = await queue.getJobCounts();
      expect(counts).toBeDefined();
      // BullMQ v5 returns an object; at minimum it has some count properties
      expect(Object.keys(counts).length).toBeGreaterThanOrEqual(4);
    } finally {
      await queue.close();
    }
  });

  it('should retry failing jobs', async () => {
    const conn = await ensureBullRedis();
    const qName = nextQueueName('retry');
    const queue = new Queue(qName, { connection: conn });

    let attemptCount = 0;

    const worker = new Worker(
      qName,
      async () => {
        attemptCount++;
        throw new Error('Simulated failure');
      },
      { connection: conn, concurrency: 1 },
    );

    try {
      await new Promise((r) => setTimeout(r, 500));

      const job = await queue.add(
        'fail',
        { x: 1 },
        {
          attempts: 3,
          backoff: { type: 'fixed', delay: 200 },
        },
      );

      const state = await waitForJobEnd(job, 15000);
      expect(state).toBe('failed');
      expect(attemptCount).toBeGreaterThanOrEqual(1);
    } finally {
      await worker.close();
      await queue.close();
    }
  }, 25000);

  it('should create and use all 4 causeflow queue names', async () => {
    const conn = await ensureBullRedis();
    const names = [
      'test-all-alerts',
      'test-all-triage',
      'test-all-investigation',
      'test-all-remediation',
    ];
    const queues = names.map((n) => new Queue(n, { connection: conn }));

    try {
      for (let i = 0; i < queues.length; i++) {
        const job = await queues[i]!.add('ping', { idx: i });
        expect(job.id).toBeDefined();
      }

      for (const q of queues) {
        const counts = await q.getJobCounts();
        expect(counts).toBeDefined();
      }
    } finally {
      for (const q of queues) {
        await q.close();
      }
    }
  });

  it('should handle fatal job failures', async () => {
    const conn = await ensureBullRedis();
    const qName = nextQueueName('fatal');
    const queue = new Queue(qName, { connection: conn });

    const worker = new Worker(
      qName,
      async () => {
        throw new Error('Fatal error');
      },
      { connection: conn, concurrency: 1 },
    );

    try {
      await new Promise((r) => setTimeout(r, 500));

      const job = await queue.add('fatal', { fatal: true }, { attempts: 1 });
      await waitForJobEnd(job, 10000);

      const state = await job.getState();
      expect(state).toBe('failed');
    } finally {
      await worker.close();
      await queue.close();
    }
  }, 15000);
});

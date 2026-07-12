import { config } from '../../../config/index.js';
import type { HealthCheck, HealthCheckResult } from '../health-checker.js';

/**
 * Queue health check for the open-source local runtime (AC-039 / AC-041).
 *
 * In the OSS runtime the durable queues are BullMQ jobs living on the same
 * Redis 7 instance the rest of the platform uses (SQS is gone — AC-041). At
 * the foundation stage (AC-039) the only thing the boot check needs to assert
 * is that the queue transport is reachable. We therefore ping Redis — a green
 * ping means the queues backend is up, so `queues: ok` is honest.
 *
 * If Redis is not reachable the check is `down` so operators get an early
 * signal before AC-041's BullMQ workers try to pull jobs.
 */
export class QueuesHealthCheck {
  name = 'queues';
  getPing;

  constructor(getPing: () => { ping(): Promise<string> } | null) {
    this.getPing = getPing;
  }

  async check(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const client = this.getPing();
      if (!client) {
        return {
          name: this.name,
          status: 'down',
          latencyMs: Date.now() - start,
          details: { error: 'Redis client not initialised' },
        };
      }
      await client.ping();
      return {
        name: this.name,
        status: 'ok',
        latencyMs: Date.now() - start,
        details: { transport: 'bullmq-on-redis', redisUrl: redactUrl(config.redis.url) },
      };
    } catch (err) {
      return {
        name: this.name,
        status: 'down',
        latencyMs: Date.now() - start,
        details: {
          transport: 'bullmq-on-redis',
          error: err instanceof Error ? err.message : 'Unknown',
        },
      };
    }
  }
}

function redactUrl(url: string): string {
  return url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
}

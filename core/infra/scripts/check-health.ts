#!/usr/bin/env tsx
/**
 * check-health.ts — poll an HTTPS /health endpoint until it returns 200 with
 * `commit` matching the expected short SHA, or the budget is exhausted.
 *
 * Uses `globalThis.fetch` (Node 22+). No `node-fetch`, no axios — zero deps.
 *
 * Tests inject a mock fetch + sleep to stay synchronous and deterministic.
 */

import { logger } from './lib/logger.js';
import { TimeoutError, VerifyError } from './lib/errors.js';
import type { HealthResponse } from './lib/types.js';

export interface CheckHealthInput {
  url: string;
  /** The git SHA we expect — will be compared against `.commit` as a prefix. */
  expectedSha: string;
  timeoutMs: number;
  pollIntervalMs: number;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export interface CheckHealthResult {
  ok: true;
  body: HealthResponse;
  commit: string;
  elapsedMs: number;
}

export async function checkHealth(input: CheckHealthInput): Promise<CheckHealthResult> {
  const fetchFn = input.fetchFn ?? globalThis.fetch;
  const sleep = input.sleep ?? realSleep;
  const now = input.now ?? Date.now;
  const started = now();

  const expectedShort = input.expectedSha.slice(0, 7);

  logger.group(`check-health ${input.url}`);
  try {
    let lastStatus: number | undefined;
    let lastCommit: string | undefined;

    for (;;) {
      const elapsedMs = now() - started;
      if (elapsedMs >= input.timeoutMs) {
        throw new TimeoutError(
          `Health check did not converge within ${input.timeoutMs}ms`,
          { url: input.url, lastStatus, lastCommit, expected: expectedShort }
        );
      }

      let res: Response | undefined;
      try {
        res = await fetchFn(input.url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
      } catch (err) {
        // Connection error — retry rather than fail.
        logger.warn('health request failed', {
          url: input.url,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      if (res) {
        lastStatus = res.status;
        if (res.status === 200) {
          let body: HealthResponse | undefined;
          try {
            body = (await res.json()) as HealthResponse;
          } catch (err) {
            logger.warn('health body parse failed', {
              error: err instanceof Error ? err.message : String(err),
            });
          }

          if (body) {
            lastCommit = body.commit;
            logger.info('poll', {
              status: res.status,
              commit: body.commit,
              expected: expectedShort,
              elapsedMs,
            });

            if (typeof body.commit !== 'string' || body.commit.length === 0) {
              throw new VerifyError(
                `/health response missing commit field`,
                { body }
              );
            }

            if (body.commit === expectedShort) {
              return { ok: true, body, commit: body.commit, elapsedMs };
            }
          }
        } else {
          logger.info('poll', { status: res.status, elapsedMs });
        }
      }

      await sleep(input.pollIntervalMs);
    }
  } finally {
    logger.endGroup();
  }
}

#!/usr/bin/env tsx
/**
 * wait-services-stable.ts — poll ECS DescribeServices until the primary
 * deployment's rolloutState is COMPLETED or the budget is exhausted.
 *
 * Why write this instead of using the built-in `services-stable` waiter from
 * aws-sdk: the SDK waiter uses hard-coded intervals and returns an opaque
 * success/failure without the intermediate state we need to report. This
 * script emits a structured state on every poll so CI logs stay readable.
 */

import { ECSClient, DescribeServicesCommand } from '@aws-sdk/client-ecs';
import { logger } from './lib/logger.js';
import { TimeoutError, VerifyError, ConfigError } from './lib/errors.js';
import type { ServiceStable } from './lib/types.js';

export interface WaitInput {
  client: ECSClient;
  clusterName: string;
  serviceName: string;
  /** Friendly name echoed in logs — 'api' | 'worker' */
  friendlyName: ServiceStable['service'];
  timeoutMs: number;
  pollIntervalMs: number;
  /**
   * Injected sleep so tests can run instantly without real setTimeout.
   * Defaults to a real setTimeout.
   */
  sleep?: (ms: number) => Promise<void>;
  /** Injected clock so tests are deterministic. Defaults to Date.now. */
  now?: () => number;
}

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait until the ECS service's primary deployment reaches COMPLETED.
 * Throws TimeoutError if the budget is exhausted.
 * Throws VerifyError if the deployment reaches FAILED.
 */
export async function waitForServiceStable(input: WaitInput): Promise<ServiceStable> {
  const sleep = input.sleep ?? realSleep;
  const now = input.now ?? Date.now;
  const started = now();

  if (input.timeoutMs <= 0 || input.pollIntervalMs <= 0) {
    throw new ConfigError('timeoutMs and pollIntervalMs must be positive');
  }

  logger.group(`wait-services-stable ${input.friendlyName}`);
  try {
    for (;;) {
      const elapsedMs = now() - started;
      if (elapsedMs >= input.timeoutMs) {
        throw new TimeoutError(
          `Service ${input.serviceName} did not stabilize within ${input.timeoutMs}ms`,
          { elapsedMs }
        );
      }

      const resp = await input.client.send(
        new DescribeServicesCommand({
          cluster: input.clusterName,
          services: [input.serviceName],
        })
      );

      const svc = resp.services?.[0];
      if (!svc) {
        throw new VerifyError(
          `DescribeServices returned no service for ${input.serviceName}`
        );
      }

      const primary =
        svc.deployments?.find((d) => d.status === 'PRIMARY') ?? svc.deployments?.[0];
      const rolloutState = (primary?.rolloutState ?? 'IN_PROGRESS') as
        | 'IN_PROGRESS'
        | 'COMPLETED'
        | 'FAILED';
      const runningCount = svc.runningCount ?? 0;
      const desiredCount = svc.desiredCount ?? 0;
      const taskDefinitionArn = primary?.taskDefinition ?? svc.taskDefinition ?? '';

      logger.info('poll', {
        service: input.friendlyName,
        rolloutState,
        runningCount,
        desiredCount,
        taskDefinitionArn,
        elapsedMs,
      });

      if (rolloutState === 'FAILED') {
        throw new VerifyError(
          `Service ${input.serviceName} deployment FAILED`,
          { rolloutState, taskDefinitionArn, elapsedMs }
        );
      }

      if (rolloutState === 'COMPLETED' && runningCount === desiredCount && desiredCount > 0) {
        return {
          service: input.friendlyName,
          clusterName: input.clusterName,
          serviceName: input.serviceName,
          rolloutState,
          taskDefinitionArn,
          runningCount,
          desiredCount,
          elapsedMs,
        };
      }

      await sleep(input.pollIntervalMs);
    }
  } finally {
    logger.endGroup();
  }
}

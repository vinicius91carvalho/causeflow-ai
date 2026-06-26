#!/usr/bin/env tsx
/**
 * verify-deploy.ts — post-deploy verification orchestrator.
 *
 * For each requested service:
 *   1. Wait for ECS services-stable (rolloutState=COMPLETED).
 *   2. For API: poll /health and assert commit === expectedSha[0..7].
 *   3. For worker: assert the running task definition matches the expected
 *      image tag (worker has no HTTP surface).
 *
 * CLI contract (from sprint spec):
 *   tsx infra/scripts/verify-deploy.ts --stage <staging|production> \
 *       --expected-sha <sha> --services api,worker
 *
 * Exit codes (sprint spec D5):
 *   0 — success
 *   1 — verification failure (commit mismatch, rollout failed, etc.)
 *   2 — config error (bad flags)
 *   3 — timeout (rollout didn't converge inside the budget)
 */

import { DescribeTaskDefinitionCommand } from '@aws-sdk/client-ecs';
import { resolveDeployConfig } from './lib/config.js';
import { createEcsClient } from './lib/aws-clients.js';
import { logger } from './lib/logger.js';
import { toDeployError, VerifyError } from './lib/errors.js';
import { waitForServiceStable } from './wait-services-stable.js';
import { checkHealth } from './check-health.js';
import { resolveImageTag } from './resolve-image-tag.js';
import type { DeployConfig, VerifyResult, ServiceName } from './lib/types.js';
import type { ECSClient } from '@aws-sdk/client-ecs';

export interface RunInput {
  config: DeployConfig;
  /** Injected for tests. Defaults to real AWS clients + global fetch. */
  ecsClient?: ECSClient;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** 12-digit AWS account ID. Defaults to env AWS_ACCOUNT_ID. */
  accountId?: string;
}

/** Cluster naming convention inherited from CDK: causeflow-${stage}. */
function clusterName(stage: DeployConfig['stage']): string {
  return `causeflow-${stage}`;
}

/** ECS service naming — API shares the cluster name, worker is suffixed. */
function serviceName(stage: DeployConfig['stage'], svc: ServiceName): string {
  const prefix = `causeflow-${stage}`;
  return svc === 'api' ? prefix : `${prefix}-worker`;
}

/** Build the staging/production `/health` URL. */
function healthUrl(stage: DeployConfig['stage']): string {
  return stage === 'staging'
    ? 'https://api-staging.causeflow.ai/health'
    : 'https://api.causeflow.ai/health';
}

/**
 * Verify a single service. Returns VerifyResult with ok=false on handled
 * failures; throws DeployError for fatal ones (timeout, bad config).
 */
async function verifyService(
  svc: ServiceName,
  input: RunInput,
  expectedImage: string
): Promise<VerifyResult> {
  const { config } = input;
  const ecs = input.ecsClient ?? createEcsClient(config.region);

  const stable = await waitForServiceStable({
    client: ecs,
    clusterName: clusterName(config.stage),
    serviceName: serviceName(config.stage, svc),
    friendlyName: svc,
    timeoutMs: config.timeoutMs,
    pollIntervalMs: config.pollIntervalMs,
    ...(input.sleep ? { sleep: input.sleep } : {}),
    ...(input.now ? { now: input.now } : {}),
  });

  if (svc === 'api') {
    const health = await checkHealth({
      url: healthUrl(config.stage),
      expectedSha: config.expectedSha,
      timeoutMs: config.timeoutMs,
      pollIntervalMs: config.pollIntervalMs,
      ...(input.fetchFn ? { fetchFn: input.fetchFn } : {}),
      ...(input.sleep ? { sleep: input.sleep } : {}),
      ...(input.now ? { now: input.now } : {}),
    });
    return {
      service: svc,
      ok: true,
      details: {
        rolloutState: stable.rolloutState,
        commit: health.commit,
        taskDefinitionArn: stable.taskDefinitionArn,
      },
    };
  }

  // Worker: assert the task definition's container image matches the expected tag.
  const td = await ecs.send(
    new DescribeTaskDefinitionCommand({ taskDefinition: stable.taskDefinitionArn })
  );
  const containers = td.taskDefinition?.containerDefinitions ?? [];
  const image = containers[0]?.image;

  if (!image || image !== expectedImage) {
    return {
      service: svc,
      ok: false,
      reason: `Worker image mismatch: running=${image ?? 'none'} expected=${expectedImage}`,
      details: { taskDefinitionArn: stable.taskDefinitionArn },
    };
  }

  return {
    service: svc,
    ok: true,
    details: {
      rolloutState: stable.rolloutState,
      taskDefinitionArn: stable.taskDefinitionArn,
      image,
    },
  };
}

export interface RunOutput {
  results: VerifyResult[];
  allOk: boolean;
}

export async function runVerify(input: RunInput): Promise<RunOutput> {
  const { config } = input;
  const accountId = input.accountId ?? process.env['AWS_ACCOUNT_ID'] ?? '409171461008';
  const tags = resolveImageTag({
    sha: config.expectedSha,
    stage: config.stage,
    accountId,
    region: config.region,
  });

  const results: VerifyResult[] = [];
  for (const svc of config.services) {
    const expected = svc === 'api' ? tags.api : tags.worker;
    try {
      const result = await verifyService(svc, input, expected);
      results.push(result);
      logger.info('service verified', { service: svc, ok: result.ok, ...(result.reason ? { reason: result.reason } : {}) });
    } catch (err) {
      // Fatal errors bubble up so the CLI can map them to exit codes.
      if (err instanceof VerifyError) {
        results.push({ service: svc, ok: false, reason: err.message, details: err.details });
        logger.error('service verify failed', { service: svc, error: err.message });
        continue;
      }
      throw err;
    }
  }

  const allOk = results.every((r) => r.ok);
  return { results, allOk };
}

// CLI entry point.
const isCli = import.meta.url === `file://${process.argv[1] ?? ''}`;
if (isCli) {
  (async () => {
    try {
      const config = resolveDeployConfig(process.argv.slice(2));
      logger.info('verify-deploy start', {
        stage: config.stage,
        expectedSha: config.expectedSha,
        services: config.services,
        timeoutMs: config.timeoutMs,
      });

      const output = await runVerify({ config });

      // Print full result summary to stdout for GitHub Actions to capture.
      process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

      if (!output.allOk) {
        logger.error('verify-deploy failed', { results: output.results });
        process.exit(1);
      }
      logger.info('verify-deploy ok');
      process.exit(0);
    } catch (err) {
      const e = toDeployError(err);
      logger.error('verify-deploy error', { name: e.name, message: e.message, details: e.details });
      process.exit(e.exitCode);
    }
  })();
}

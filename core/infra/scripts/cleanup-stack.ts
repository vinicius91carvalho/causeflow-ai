#!/usr/bin/env tsx
/**
 * cleanup-stack.ts — one-time recovery tool for stuck CloudFormation stacks.
 *
 * Deliberately NOT wired into deploy.yml. Sprint 3 explicitly removes the
 * stack-status cleanup step from the workflow (I3 + deliberate decision): if
 * a stack is stuck, a human runs this script locally with admin credentials.
 * The workflow's OIDC role doesn't have the blast radius to handle bad states.
 *
 * Handles the full set of recoverable terminal states:
 *   ROLLBACK_COMPLETE, ROLLBACK_FAILED,
 *   DELETE_FAILED,
 *   CREATE_FAILED,
 *   REVIEW_IN_PROGRESS,
 *   UPDATE_ROLLBACK_FAILED  ← the one that caused the original Sprint 2 stuck-state.
 *
 * All other states are treated as non-recoverable — this script will refuse
 * to delete a healthy stack by accident.
 */

import {
  DescribeStacksCommand,
  DeleteStackCommand,
  type StackStatus,
} from '@aws-sdk/client-cloudformation';
import { createCfnClient } from './lib/aws-clients.js';
import { parseArgs } from './lib/config.js';
import { logger } from './lib/logger.js';
import { ConfigError, VerifyError, toDeployError } from './lib/errors.js';

const RECOVERABLE: readonly StackStatus[] = [
  'ROLLBACK_COMPLETE',
  'ROLLBACK_FAILED',
  'DELETE_FAILED',
  'CREATE_FAILED',
  'REVIEW_IN_PROGRESS',
  'UPDATE_ROLLBACK_FAILED',
] as const;

export interface CleanupInput {
  stackName: string;
  region: string;
  /** Safety flag: must be passed to actually delete. */
  confirm: boolean;
}

export async function cleanupStack(input: CleanupInput): Promise<{
  previousStatus?: StackStatus;
  action: 'noop' | 'delete_requested' | 'not_found';
}> {
  const cfn = createCfnClient(input.region);
  logger.group(`cleanup-stack ${input.stackName}`);
  try {
    let status: StackStatus | undefined;
    try {
      const desc = await cfn.send(
        new DescribeStacksCommand({ StackName: input.stackName })
      );
      status = desc.Stacks?.[0]?.StackStatus;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/does not exist/i.test(msg)) {
        logger.info('stack not found', { stackName: input.stackName });
        return { action: 'not_found' };
      }
      throw err;
    }

    if (!status) {
      throw new VerifyError(`DescribeStacks returned no status for ${input.stackName}`);
    }

    logger.info('current status', { stackName: input.stackName, status });

    if (!RECOVERABLE.includes(status)) {
      logger.info('healthy state — nothing to do', { status });
      return { action: 'noop', previousStatus: status };
    }

    if (!input.confirm) {
      throw new ConfigError(
        `Stack ${input.stackName} is in ${status}. Pass --confirm to delete.`
      );
    }

    await cfn.send(new DeleteStackCommand({ StackName: input.stackName }));
    logger.info('delete requested — waiting for DELETE_COMPLETE asynchronously', {
      stackName: input.stackName,
    });
    return { action: 'delete_requested', previousStatus: status };
  } finally {
    logger.endGroup();
  }
}

const isCli = import.meta.url === `file://${process.argv[1] ?? ''}`;
if (isCli) {
  (async () => {
    try {
      const args = parseArgs(process.argv.slice(2));
      const stackName = args.stage ? `causeflow-${args.stage}` : undefined;
      if (!stackName) {
        throw new ConfigError('Missing --stage (staging|production)');
      }
      const region = process.env['AWS_REGION'] ?? 'us-east-2';
      const confirm = process.argv.includes('--confirm');

      const result = await cleanupStack({ stackName, region, confirm });
      process.stdout.write(`${JSON.stringify(result)}\n`);
      process.exit(0);
    } catch (err) {
      const e = toDeployError(err);
      logger.error('cleanup-stack error', { message: e.message });
      process.exit(e.exitCode);
    }
  })();
}

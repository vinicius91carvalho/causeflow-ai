#!/usr/bin/env tsx
/**
 * resolve-image-tag.ts — pure function that computes ECR image URIs from a
 * git SHA + stage. Exported for reuse by verify-deploy.ts and callable as a
 * CLI for ad-hoc shell debugging.
 *
 * Contract:
 *   input:  git SHA (>=7 hex chars), stage, account id, region
 *   output: { api, worker, shortSha }
 *
 * Why a separate script: the sprint demands no inline bash in workflows. A
 * future workflow job can `tsx infra/scripts/resolve-image-tag.ts --sha X`
 * instead of running `${GITHUB_SHA::7}` in a shell block.
 */

import { ConfigError } from './lib/errors.js';
import { parseArgs } from './lib/config.js';
import type { ImageTags, StageName } from './lib/types.js';

export interface ResolveInput {
  sha: string;
  stage: StageName;
  accountId: string;
  region: string;
}

/**
 * Pure function — no AWS calls, no filesystem. Easy to unit test.
 *
 * Image naming convention (Sprint 2 CDK + Sprint 3 workflow):
 *   - API:    ${registry}/causeflow-${stage}:${shortSha}
 *   - Worker: ${registry}/causeflow-${stage}:worker-${shortSha}
 */
export function resolveImageTag(input: ResolveInput): ImageTags {
  if (!/^[0-9a-f]{7,40}$/.test(input.sha)) {
    throw new ConfigError(
      `Invalid sha "${input.sha}". Must be 7-40 lowercase hex characters.`
    );
  }
  if (!/^\d{12}$/.test(input.accountId)) {
    throw new ConfigError(`Invalid accountId "${input.accountId}". Must be 12 digits.`);
  }
  if (input.stage !== 'staging' && input.stage !== 'production') {
    throw new ConfigError(`Invalid stage "${input.stage}".`);
  }

  const shortSha = input.sha.slice(0, 7);
  const registry = `${input.accountId}.dkr.ecr.${input.region}.amazonaws.com`;
  const repo = `causeflow-${input.stage}`;

  return {
    api: `${registry}/${repo}:${shortSha}`,
    worker: `${registry}/${repo}:worker-${shortSha}`,
    shortSha,
  };
}

// CLI entry point — only runs when executed directly, never on import.
// Using import.meta.url instead of require.main so it works under ESM.
const isCli = import.meta.url === `file://${process.argv[1] ?? ''}`;
if (isCli) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const sha = args.expectedSha ?? process.env['GITHUB_SHA'];
    if (!sha) throw new ConfigError('Missing --expected-sha or GITHUB_SHA env');
    const stage = (args.stage ?? 'staging') as StageName;
    const accountId = process.env['AWS_ACCOUNT_ID'] ?? '409171461008';
    const region = process.env['AWS_REGION'] ?? 'us-east-2';

    const tags = resolveImageTag({ sha, stage, accountId, region });
    // stdout is piping-safe: JSON on stdout, logs on stderr.
    process.stdout.write(`${JSON.stringify(tags)}\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    const exitCode = err instanceof ConfigError ? err.exitCode : 1;
    process.exit(exitCode);
  }
}

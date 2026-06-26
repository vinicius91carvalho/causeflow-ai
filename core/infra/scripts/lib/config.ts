/**
 * Config parsing + validation for infra/scripts/*.
 *
 * Intentionally tiny: no yargs, no commander. These scripts run on a fresh
 * runner and every import adds cold-start time. Parse flags manually.
 */

import { ConfigError } from './errors.js';
import type { DeployConfig, ServiceName, StageName } from './types.js';

const VALID_STAGES: readonly StageName[] = ['staging', 'production'];
const VALID_SERVICES: readonly ServiceName[] = ['api', 'worker'];

export interface ParsedArgs {
  stage?: string;
  expectedSha?: string;
  services?: string;
  timeoutMs?: string;
  pollIntervalMs?: string;
}

/**
 * Parse `--key value` / `--key=value` pairs from argv.
 * Unknown flags are preserved so callers can do additional parsing.
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg || !arg.startsWith('--')) continue;

    const eqIdx = arg.indexOf('=');
    let key: string;
    let value: string | undefined;

    if (eqIdx >= 0) {
      key = arg.slice(2, eqIdx);
      value = arg.slice(eqIdx + 1);
    } else {
      key = arg.slice(2);
      value = argv[i + 1];
      if (value && value.startsWith('--')) value = undefined;
      else if (value !== undefined) i++;
    }

    // Map kebab-case CLI flags to camelCase struct fields.
    const camel = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    (out as Record<string, string | undefined>)[camel] = value;
  }
  return out;
}

function assertStage(value: string | undefined): StageName {
  if (!value) {
    throw new ConfigError('Missing required flag --stage (staging|production)');
  }
  if (!VALID_STAGES.includes(value as StageName)) {
    throw new ConfigError(
      `Invalid --stage "${value}". Must be one of: ${VALID_STAGES.join(', ')}`
    );
  }
  return value as StageName;
}

function assertSha(value: string | undefined): string {
  if (!value) {
    throw new ConfigError('Missing required flag --expected-sha');
  }
  // Git SHAs are 7-40 lowercase hex chars.
  if (!/^[0-9a-f]{7,40}$/.test(value)) {
    throw new ConfigError(
      `Invalid --expected-sha "${value}". Must be 7-40 lowercase hex characters.`
    );
  }
  return value;
}

function assertServices(value: string | undefined): ServiceName[] {
  if (!value) {
    throw new ConfigError('Missing required flag --services (comma-separated, e.g. api,worker)');
  }
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) {
    throw new ConfigError('--services must list at least one service');
  }
  for (const s of parts) {
    if (!VALID_SERVICES.includes(s as ServiceName)) {
      throw new ConfigError(
        `Invalid service "${s}". Must be one of: ${VALID_SERVICES.join(', ')}`
      );
    }
  }
  return parts as ServiceName[];
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  flagName: string
): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new ConfigError(`Invalid ${flagName} "${value}". Must be a positive integer.`);
  }
  return n;
}

/** Resolve DeployConfig from argv + environment. */
export function resolveDeployConfig(argv: readonly string[]): DeployConfig {
  const args = parseArgs(argv);

  const stage = assertStage(args.stage);
  const expectedSha = assertSha(args.expectedSha);
  const services = assertServices(args.services);
  const timeoutMs = parsePositiveInt(args.timeoutMs, 600_000, '--timeout-ms');
  const pollIntervalMs = parsePositiveInt(args.pollIntervalMs, 10_000, '--poll-interval-ms');

  const region = process.env['AWS_REGION'] ?? 'us-east-2';

  return { stage, expectedSha, services, timeoutMs, pollIntervalMs, region };
}

export { VALID_STAGES, VALID_SERVICES };

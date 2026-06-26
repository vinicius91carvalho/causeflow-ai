/**
 * Error hierarchy for infra/scripts/*.
 *
 * Every error exposes a numeric `exitCode` so CLI wrappers can map failures
 * to deterministic process exit codes without a giant switch. The values
 * match the verify-deploy.ts contract in the sprint spec:
 *
 *   0 — success            (no error raised)
 *   1 — verification failure
 *   2 — config error
 *   3 — timeout
 */

export abstract class DeployError extends Error {
  abstract readonly exitCode: number;

  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
  }
}

export class VerifyError extends DeployError {
  readonly exitCode = 1;
}

export class ConfigError extends DeployError {
  readonly exitCode = 2;
}

export class TimeoutError extends DeployError {
  readonly exitCode = 3;
}

/**
 * Narrow unknown thrown values into a DeployError. Used by the script
 * entry points so they never need `instanceof Error` checks inline.
 */
export function toDeployError(err: unknown): DeployError {
  if (err instanceof DeployError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new VerifyError(message);
}

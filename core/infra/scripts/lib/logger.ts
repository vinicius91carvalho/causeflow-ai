/**
 * Structured logger for infra/scripts/*.
 *
 * - Emits JSON lines on stderr (stdout is reserved for script outputs that
 *   another tool might pipe, e.g. resolved image tags).
 * - When running inside GitHub Actions (detected via `GITHUB_ACTIONS=true`),
 *   also emits `::group::` / `::endgroup::` so the job log collapses nicely.
 *
 * Intentionally tiny: no pino, no winston. The entire point of this file is
 * that deploy scripts must boot in < 300ms on a cold runner without pulling
 * in a logger that dwarfs the script itself.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

function isActions(): boolean {
  return process.env['GITHUB_ACTIONS'] === 'true';
}

function emit(level: Level, msg: string, meta?: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta ?? {}),
  });
  // Use stderr so script stdout stays clean for piping.
  process.stderr.write(`${line}\n`);
}

export const logger = {
  debug(msg: string, meta?: Record<string, unknown>): void {
    if (process.env['DEBUG']) emit('debug', msg, meta);
  },
  info(msg: string, meta?: Record<string, unknown>): void {
    emit('info', msg, meta);
  },
  warn(msg: string, meta?: Record<string, unknown>): void {
    emit('warn', msg, meta);
  },
  error(msg: string, meta?: Record<string, unknown>): void {
    emit('error', msg, meta);
  },
  group(name: string): void {
    if (isActions()) process.stderr.write(`::group::${name}\n`);
    else emit('info', `── ${name} ──`);
  },
  endGroup(): void {
    if (isActions()) process.stderr.write('::endgroup::\n');
  },
};

import { createConnection } from 'node:net';
import { config } from '../../../config/index.js';
import type { HealthCheck, HealthCheckResult } from '../health-checker.js';

/**
 * Postgres reachability health check for the open-source local runtime.
 *
 * AC-039 requires `/health` to report `postgres: ok` once the bundled
 * `causeflow-postgres` container is up. We deliberately avoid pulling in a
 * full `pg` driver here (that wiring arrives with AC-040) and instead perform
 * a TCP liveness probe against the Postgres host:port. A successful TCP
 * handshake means the database server is accepting connections — which is
 * exactly what the foundation boot check is asserting. No credentials are
 * sent over the wire, so this never authenticates or contacts any external
 * SaaS endpoint.
 */
export class PostgresHealthCheck {
  name = 'postgres';
  host;
  port;
  timeoutMs;

  constructor(opts?: { host?: string; port?: number; timeoutMs?: number }) {
    this.host = opts?.host ?? resolvePostgresHost();
    this.port = opts?.port ?? resolvePostgresPort();
    this.timeoutMs = opts?.timeoutMs ?? 2_000;
  }

  async check(): Promise<HealthCheckResult> {
    const start = Date.now();
    const ok = await tcpOpen(this.host, this.port, this.timeoutMs);
    return ok
      ? {
          name: this.name,
          status: 'ok',
          latencyMs: Date.now() - start,
          details: { host: this.host, port: this.port },
        }
      : {
          name: this.name,
          status: 'down',
          latencyMs: Date.now() - start,
          details: { host: this.host, port: this.port, error: 'connection refused/timeout' },
        };
  }
}

function resolvePostgresHost(): string {
  const url = config.postgres.url;
  if (url) {
    // Accept both postgresql://user@host and postgresql://user:pass@host:port/db
    const m = url.match(/postgres(?:ql)?:\/\/(?:[^@/?#]+)@([^:/]+)(?::(\d+))?/i);
    if (m?.[1]) return m[1];
    try {
      const parsed = new URL(url);
      if (parsed.hostname) return parsed.hostname;
    } catch {
      /* fall through */
    }
  }
  return config.postgres.host;
}

function resolvePostgresPort(): number {
  const url = config.postgres.url;
  if (url) {
    const m = url.match(/postgres(?:ql)?:\/\/(?:[^@/?#]+)@[^:/]+:(\d+)/i);
    if (m?.[1]) return parseInt(m[1], 10);
    try {
      const parsed = new URL(url);
      if (parsed.port) return parseInt(parsed.port, 10);
    } catch {
      /* fall through */
    }
  }
  return config.postgres.port;
}

function tcpOpen(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    const socket = createConnection({ host, port }, () => finish(true));
    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));
  });
}

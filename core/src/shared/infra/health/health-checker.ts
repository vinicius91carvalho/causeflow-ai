export interface HealthCheckResult {
  name: string;
  status: 'ok' | 'degraded' | 'down' | 'skipped';
  latencyMs: number;
  details?: Record<string, unknown>;
}

export interface HealthCheck {
  name: string;
  check(): Promise<HealthCheckResult>;
}

export interface AggregatedHealth {
  status: 'ok' | 'degraded' | 'down';
  checks: HealthCheckResult[];
  timestamp: string;
}

export class HealthChecker {
  checks: HealthCheck[] = [];
  register(check: HealthCheck): void {
    this.checks.push(check);
  }
  async runAll(): Promise<AggregatedHealth> {
    const results = await Promise.all(
      this.checks.map(async (check) => {
        try {
          return await check.check();
        } catch (err) {
          return {
            name: check.name,
            status: 'down' as const,
            latencyMs: 0,
            details: { error: err instanceof Error ? err.message : 'Unknown error' },
          };
        }
      }),
    );
    let aggregated: 'ok' | 'degraded' | 'down' = 'ok';
    for (const result of results) {
      // 'skipped' checks (e.g. Anthropic with no API key in the OSS
      // runtime) do not affect the aggregate — they are neither healthy
      // nor unhealthy, just not configured.
      if (result.status === 'skipped') {
        continue;
      }
      if (result.status === 'down') {
        aggregated = 'down';
        break;
      }
      if (result.status === 'degraded') {
        aggregated = 'degraded';
      }
    }
    return {
      status: aggregated,
      checks: results,
      timestamp: new Date().toISOString(),
    };
  }
}

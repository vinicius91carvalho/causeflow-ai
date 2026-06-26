import type { IReadOnlyDriver, DriverCommand, DriverResult, DriverFactory, DriverValidation } from '../driver.port.js';
import type { ResourceConfig } from '../../config/schema.js';

export interface PromDriverConfig {
  baseUrl: string;
  bearerToken?: string;
  timeoutMs?: number;
}

export class PrometheusDriver implements IReadOnlyDriver {
  readonly type = 'prometheus' as const;

  constructor(private config: PromDriverConfig) {}

  validate(command: DriverCommand): DriverValidation {
    if (command.operation === 'query' || command.operation === 'query_range') {
      const q = command.params['query'];
      if (typeof q !== 'string' || !q.trim()) return { valid: false, reason: 'Missing query' };
    }
    return { valid: true };
  }

  async execute(command: DriverCommand): Promise<DriverResult> {
    const start = Date.now();
    switch (command.operation) {
      case 'list_tables': {
        const url = new URL('/api/v1/label/__name__/values', this.config.baseUrl);
        const body = (await this.get(url)) as { data?: string[] };
        const metrics = body.data ?? [];
        return {
          rows: metrics.map((m) => ({ metric: m })),
          rowCount: metrics.length,
          executionTimeMs: Date.now() - start,
        };
      }
      case 'query': {
        const url = new URL('/api/v1/query', this.config.baseUrl);
        url.searchParams.set('query', command.params['query'] as string);
        if (command.params['time']) url.searchParams.set('time', String(command.params['time']));
        const body = await this.get(url);
        return { rows: [body as Record<string, unknown>], rowCount: 1, executionTimeMs: Date.now() - start };
      }
      case 'query_range': {
        const url = new URL('/api/v1/query_range', this.config.baseUrl);
        url.searchParams.set('query', command.params['query'] as string);
        url.searchParams.set('start', String(command.params['start']));
        url.searchParams.set('end', String(command.params['end']));
        url.searchParams.set('step', String(command.params['step'] ?? '60s'));
        const body = await this.get(url);
        return { rows: [body as Record<string, unknown>], rowCount: 1, executionTimeMs: Date.now() - start };
      }
      default:
        throw new Error(`Unknown operation: ${command.operation}`);
    }
  }

  private async get(url: URL): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (this.config.bearerToken) headers['Authorization'] = `Bearer ${this.config.bearerToken}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 30_000);
    try {
      const res = await fetch(url.toString(), { headers, signal: controller.signal });
      if (!res.ok) throw new Error(`Prometheus ${res.status}`);
      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = new URL('/-/healthy', this.config.baseUrl);
      const res = await fetch(url.toString());
      return res.ok;
    } catch {
      return false;
    }
  }

  capabilities(): string[] {
    return ['query', 'query_range', 'list_tables'];
  }

  async close(): Promise<void> { /* no state */ }
}

export const prometheusDriverFactory: DriverFactory = {
  type: 'prometheus',
  async create(resource: ResourceConfig, secrets: Record<string, string>): Promise<IReadOnlyDriver> {
    const conn = resource.connection;
    return new PrometheusDriver({
      baseUrl: secrets['baseUrl'] ?? conn['baseUrl'] ?? 'http://localhost:9090',
      bearerToken: secrets['bearerToken'] ?? conn['bearerToken'],
      timeoutMs: resource.statementTimeoutMs,
    });
  },
};

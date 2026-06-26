import type { IReadOnlyDriver, DriverCommand, DriverResult, DriverFactory, DriverValidation } from '../driver.port.js';
import type { ResourceConfig } from '../../config/schema.js';

export interface HttpDriverConfig {
  baseUrl: string;
  allowedPaths?: string[];
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRows?: number;
}

const ALLOWED_METHODS = new Set(['GET', 'HEAD']);

export class HttpDriver implements IReadOnlyDriver {
  readonly type = 'http' as const;
  private allowedPaths: RegExp[];

  constructor(private config: HttpDriverConfig) {
    this.allowedPaths = (config.allowedPaths ?? ['.*']).map((p) => new RegExp(p));
  }

  validate(command: DriverCommand): DriverValidation {
    if (command.operation !== 'query' && command.operation !== 'describe_table' && command.operation !== 'list_tables') {
      return { valid: false, reason: `Operation ${command.operation} not supported on HTTP driver` };
    }
    if (command.operation === 'query') {
      const method = (command.params['method'] as string | undefined)?.toUpperCase() ?? 'GET';
      if (!ALLOWED_METHODS.has(method)) {
        return { valid: false, reason: `HTTP method ${method} not allowed` };
      }
      const path = command.params['path'];
      if (typeof path !== 'string') return { valid: false, reason: 'Missing path' };
      if (!this.allowedPaths.some((re) => re.test(path))) {
        return { valid: false, reason: `Path ${path} not in allowlist` };
      }
    }
    return { valid: true };
  }

  async execute(command: DriverCommand): Promise<DriverResult> {
    const start = Date.now();
    switch (command.operation) {
      case 'list_tables': {
        return {
          rows: [{ description: 'HTTP driver — use query with path parameter', baseUrl: this.config.baseUrl }],
          rowCount: 1,
          executionTimeMs: Date.now() - start,
        };
      }
      case 'describe_table':
      case 'query': {
        const path = command.params['path'] as string;
        const method = (command.params['method'] as string | undefined)?.toUpperCase() ?? 'GET';
        const query = (command.params['query'] as Record<string, string> | undefined) ?? {};
        const url = new URL(path, this.config.baseUrl);
        for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 30_000);
        try {
          const res = await fetch(url.toString(), {
            method,
            headers: { ...(this.config.headers ?? {}) },
            signal: controller.signal,
          });
          const contentType = res.headers.get('content-type') ?? '';
          let body: unknown;
          if (contentType.includes('application/json')) {
            body = await res.json();
          } else {
            body = await res.text();
          }
          return {
            rows: [{
              status: res.status,
              url: url.toString(),
              body,
            }],
            rowCount: 1,
            executionTimeMs: Date.now() - start,
          };
        } finally {
          clearTimeout(timer);
        }
      }
      default:
        throw new Error(`Unknown operation: ${command.operation}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(this.config.baseUrl, { method: 'HEAD' });
      return res.status < 500;
    } catch {
      return false;
    }
  }

  capabilities(): string[] {
    return ['query', 'list_tables', 'describe_table'];
  }

  async close(): Promise<void> { /* fetch has no persistent state */ }
}

export const httpDriverFactory: DriverFactory = {
  type: 'http',
  async create(resource: ResourceConfig, secrets: Record<string, string>): Promise<IReadOnlyDriver> {
    const conn = resource.connection;
    const headers: Record<string, string> = {};
    if (secrets['authorization'] ?? conn['authorization']) {
      headers['Authorization'] = secrets['authorization'] ?? conn['authorization']!;
    }
    return new HttpDriver({
      baseUrl: secrets['baseUrl'] ?? conn['baseUrl'] ?? 'http://localhost',
      allowedPaths: conn['allowedPaths'] ? JSON.parse(conn['allowedPaths']) as string[] : undefined,
      headers,
      timeoutMs: resource.statementTimeoutMs,
      maxRows: resource.maxRowsPerQuery,
    });
  },
};

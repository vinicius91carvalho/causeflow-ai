import type { IReadOnlyDriver, DriverCommand, DriverResult, DriverFactory, DriverValidation } from '../driver.port.js';
import type { ResourceConfig } from '../../config/schema.js';

const ALLOWED_VERBS = new Set(['get', 'list', 'watch']);

export interface KubeDriverConfig {
  apiServer: string;
  token: string;
  caCert?: string;
  namespace?: string;
  timeoutMs?: number;
  maxRows?: number;
}

export class KubernetesDriver implements IReadOnlyDriver {
  readonly type = 'kubernetes' as const;
  private maxRows: number;

  constructor(private config: KubeDriverConfig) {
    this.maxRows = config.maxRows ?? 1000;
  }

  validate(command: DriverCommand): DriverValidation {
    if (command.operation === 'query') {
      const verb = (command.params['verb'] as string | undefined)?.toLowerCase();
      if (!verb || !ALLOWED_VERBS.has(verb)) {
        return { valid: false, reason: 'verb must be one of: get, list, watch' };
      }
      const kind = command.params['kind'];
      if (typeof kind !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(kind)) {
        return { valid: false, reason: 'Invalid kind' };
      }
    }
    return { valid: true };
  }

  async execute(command: DriverCommand): Promise<DriverResult> {
    const start = Date.now();
    switch (command.operation) {
      case 'list_tables': {
        const url = new URL('/api/v1', this.config.apiServer);
        const body = (await this.get(url)) as { resources?: unknown[] };
        const rows = (body.resources ?? []) as Record<string, unknown>[];
        return { rows, rowCount: rows.length, executionTimeMs: Date.now() - start };
      }
      case 'query': {
        const kind = (command.params['kind'] as string).toLowerCase();
        const namespace = (command.params['namespace'] as string) ?? this.config.namespace;
        const name = command.params['name'] as string | undefined;
        const plural = kind.endsWith('s') ? kind : `${kind}s`;
        const path = namespace
          ? `/api/v1/namespaces/${namespace}/${plural}${name ? `/${name}` : ''}`
          : `/api/v1/${plural}${name ? `/${name}` : ''}`;
        const url = new URL(path, this.config.apiServer);
        const body = (await this.get(url)) as { items?: unknown[] } | Record<string, unknown>;
        const items = 'items' in body && Array.isArray((body as { items?: unknown[] }).items)
          ? (body as { items: unknown[] }).items as Record<string, unknown>[]
          : [body as Record<string, unknown>];
        const limited = items.slice(0, this.maxRows);
        return { rows: limited, rowCount: limited.length, executionTimeMs: Date.now() - start };
      }
      default:
        throw new Error(`Unknown operation: ${command.operation}`);
    }
  }

  private async get(url: URL): Promise<unknown> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.token}`,
      Accept: 'application/json',
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 30_000);
    try {
      const res = await fetch(url.toString(), { headers, signal: controller.signal });
      if (!res.ok) throw new Error(`Kubernetes API ${res.status}: ${await res.text()}`);
      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = new URL('/livez', this.config.apiServer);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${this.config.token}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  capabilities(): string[] {
    return ['query', 'list_tables'];
  }

  async close(): Promise<void> { /* stateless */ }
}

export const kubernetesDriverFactory: DriverFactory = {
  type: 'kubernetes',
  async create(resource: ResourceConfig, secrets: Record<string, string>): Promise<IReadOnlyDriver> {
    const conn = resource.connection;
    return new KubernetesDriver({
      apiServer: secrets['apiServer'] ?? conn['apiServer'] ?? 'https://kubernetes.default.svc',
      token: secrets['token'] ?? conn['token'] ?? '',
      caCert: secrets['caCert'] ?? conn['caCert'],
      namespace: conn['namespace'],
      timeoutMs: resource.statementTimeoutMs,
      maxRows: resource.maxRowsPerQuery,
    });
  },
};

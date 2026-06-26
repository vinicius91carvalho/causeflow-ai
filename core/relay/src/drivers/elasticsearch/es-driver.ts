import type { IReadOnlyDriver, DriverCommand, DriverResult, DriverFactory, DriverValidation } from '../driver.port.js';
import type { ResourceConfig } from '../../config/schema.js';

const ALLOWED_ES_KEYS = new Set([
  'query', 'size', 'from', 'sort', 'aggs', 'aggregations',
  '_source', 'script_fields', 'fields', 'highlight', 'track_total_hits', 'timeout',
]);

function validateEsBody(body: unknown): { valid: boolean; reason?: string } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, reason: 'Body must be an object' };
  }
  for (const key of Object.keys(body as Record<string, unknown>)) {
    if (!ALLOWED_ES_KEYS.has(key)) {
      return { valid: false, reason: `ES key ${key} not allowed` };
    }
  }
  return { valid: true };
}

interface EsClient {
  ping(): Promise<unknown>;
  search(params: { index: string; body: Record<string, unknown> }): Promise<unknown>;
  indices: {
    getMapping(params: { index: string }): Promise<unknown>;
    get(params: { index: string }): Promise<unknown>;
  };
  cat: {
    indices(params: { format: string }): Promise<unknown>;
  };
  close(): Promise<void>;
}

export interface EsDriverConfig {
  node: string;
  apiKey?: string;
  username?: string;
  password?: string;
  maxRows?: number;
}

export class ElasticsearchDriver implements IReadOnlyDriver {
  readonly type = 'elasticsearch' as const;
  private clientPromise: Promise<EsClient>;
  private maxRows: number;

  constructor(config: EsDriverConfig) {
    this.maxRows = config.maxRows ?? 1000;
    this.clientPromise = (async () => {
      const mod = await import('@elastic/elasticsearch');
      const { Client } = mod as unknown as {
        Client: new (opts: Record<string, unknown>) => EsClient;
      };
      return new Client({
        node: config.node,
        auth: config.apiKey
          ? { apiKey: config.apiKey }
          : config.username
          ? { username: config.username, password: config.password }
          : undefined,
      });
    })();
  }

  validate(command: DriverCommand): DriverValidation {
    if (command.operation === 'query') {
      const index = command.params['index'];
      if (typeof index !== 'string' || !/^[a-zA-Z0-9_.*-]+$/.test(index)) {
        return { valid: false, reason: 'Invalid index name' };
      }
      const body = command.params['body'];
      if (body !== undefined) {
        const r = validateEsBody(body);
        if (!r.valid) return r;
      }
    }
    return { valid: true };
  }

  async execute(command: DriverCommand): Promise<DriverResult> {
    const start = Date.now();
    const client = await this.clientPromise;

    switch (command.operation) {
      case 'list_tables': {
        const response = (await client.cat.indices({ format: 'json' })) as { body?: unknown[] } | unknown[];
        const rows = (Array.isArray(response) ? response : (response as { body?: unknown[] }).body ?? []) as Record<string, unknown>[];
        return { rows, rowCount: rows.length, executionTimeMs: Date.now() - start };
      }
      case 'describe_table': {
        const index = command.params['tableName'] as string;
        const response = await client.indices.getMapping({ index });
        return {
          rows: [response as unknown as Record<string, unknown>],
          rowCount: 1,
          executionTimeMs: Date.now() - start,
        };
      }
      case 'query': {
        const index = command.params['index'] as string;
        const limit = Math.min(Number(command.params['size'] ?? this.maxRows), this.maxRows);
        const body = { ...(command.params['body'] as Record<string, unknown>), size: limit };
        const response = (await client.search({ index, body })) as {
          body?: { hits?: { hits?: unknown[] } };
          hits?: { hits?: unknown[] };
        };
        const hits = (response.body?.hits?.hits ?? response.hits?.hits ?? []) as Record<string, unknown>[];
        return {
          rows: hits,
          rowCount: hits.length,
          executionTimeMs: Date.now() - start,
        };
      }
      default:
        throw new Error(`Unknown operation: ${command.operation}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.clientPromise;
      await client.ping();
      return true;
    } catch {
      return false;
    }
  }

  capabilities(): string[] {
    return ['query', 'describe_table', 'list_tables'];
  }

  async close(): Promise<void> {
    const client = await this.clientPromise;
    await client.close();
  }
}

export const elasticsearchDriverFactory: DriverFactory = {
  type: 'elasticsearch',
  async create(resource: ResourceConfig, secrets: Record<string, string>): Promise<IReadOnlyDriver> {
    const conn = resource.connection;
    return new ElasticsearchDriver({
      node: secrets['node'] ?? conn['node'] ?? 'http://localhost:9200',
      apiKey: secrets['apiKey'] ?? conn['apiKey'],
      username: secrets['username'] ?? conn['username'],
      password: secrets['password'] ?? conn['password'],
      maxRows: resource.maxRowsPerQuery,
    });
  },
};

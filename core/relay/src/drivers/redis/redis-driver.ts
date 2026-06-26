import type { IReadOnlyDriver, DriverCommand, DriverResult, DriverFactory, DriverValidation } from '../driver.port.js';
import type { ResourceConfig } from '../../config/schema.js';

const ALLOWED_COMMANDS = new Set<string>([
  'GET', 'MGET', 'EXISTS', 'TYPE', 'TTL', 'PTTL',
  'HGET', 'HGETALL', 'HMGET', 'HEXISTS', 'HKEYS', 'HVALS', 'HLEN',
  'LLEN', 'LINDEX', 'LRANGE',
  'SMEMBERS', 'SISMEMBER', 'SCARD',
  'ZRANGE', 'ZREVRANGE', 'ZRANGEBYSCORE', 'ZCARD', 'ZSCORE',
  'OBJECT', 'DEBUG', 'INFO', 'DBSIZE', 'CLIENT',
]);

interface RedisClient {
  scan(cursor: string, ...args: string[]): Promise<[string, string[]]>;
  call(cmd: string, ...args: string[]): Promise<unknown>;
  info(section?: string): Promise<string>;
  ping(): Promise<string>;
  quit(): Promise<'OK'>;
}

export interface RedisDriverConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  tls?: boolean;
  maxRows?: number;
}

export class RedisDriver implements IReadOnlyDriver {
  readonly type = 'redis' as const;
  private clientPromise: Promise<RedisClient>;
  private maxRows: number;

  constructor(config: RedisDriverConfig) {
    this.maxRows = config.maxRows ?? 1000;
    this.clientPromise = (async () => {
      const mod = await import('ioredis');
      const Redis = (mod as unknown as { default: new (opts: Record<string, unknown>) => RedisClient }).default;
      return new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db,
        tls: config.tls ? {} : undefined,
        maxRetriesPerRequest: 2,
        enableOfflineQueue: false,
      });
    })();
  }

  validate(command: DriverCommand): DriverValidation {
    if (command.operation === 'query') {
      const cmd = command.params['command'];
      if (typeof cmd !== 'string') return { valid: false, reason: 'Missing command' };
      const upper = cmd.toUpperCase();
      if (!ALLOWED_COMMANDS.has(upper)) {
        return { valid: false, reason: `Command ${upper} is not allowed (read-only subset enforced)` };
      }
    }
    return { valid: true };
  }

  async execute(command: DriverCommand): Promise<DriverResult> {
    const start = Date.now();
    const client = await this.clientPromise;

    switch (command.operation) {
      case 'list_tables': {
        const info = await client.info('keyspace');
        const rows = info
          .split('\n')
          .filter((l) => l.startsWith('db'))
          .map((l) => {
            const [name, rest] = l.split(':');
            return { database: name, info: rest };
          });
        return { rows, rowCount: rows.length, executionTimeMs: Date.now() - start };
      }
      case 'describe_table': {
        const pattern = (command.params['pattern'] as string) ?? '*';
        const rows: Record<string, unknown>[] = [];
        let cursor = '0';
        do {
          const [next, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
          for (const key of keys) {
            if (rows.length >= this.maxRows) break;
            const type = await client.call('TYPE', key);
            rows.push({ key, type });
          }
          cursor = next;
        } while (cursor !== '0' && rows.length < this.maxRows);
        return { rows, rowCount: rows.length, executionTimeMs: Date.now() - start };
      }
      case 'query': {
        const cmd = (command.params['command'] as string).toUpperCase();
        const args = (command.params['args'] as string[] | undefined) ?? [];
        const result = await client.call(cmd, ...args);
        return {
          rows: [{ command: cmd, result }],
          rowCount: 1,
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
    await client.quit().catch(() => undefined);
  }
}

export const redisDriverFactory: DriverFactory = {
  type: 'redis',
  async create(resource: ResourceConfig, secrets: Record<string, string>): Promise<IReadOnlyDriver> {
    const conn = resource.connection;
    return new RedisDriver({
      host: secrets['host'] ?? conn['host'] ?? 'localhost',
      port: Number(secrets['port'] ?? conn['port'] ?? 6379),
      password: secrets['password'] ?? conn['password'],
      db: Number(conn['db'] ?? 0),
      tls: conn['tls'] === 'true',
      maxRows: resource.maxRowsPerQuery,
    });
  },
};

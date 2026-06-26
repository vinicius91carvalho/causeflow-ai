import { MongoClient, type Db, type Document } from 'mongodb';
import type { IReadOnlyDriver, DriverCommand, DriverResult, DriverFactory, DriverValidation } from '../driver.port.js';
import type { ResourceConfig } from '../../config/schema.js';
import pino from 'pino';

const logger = pino({ name: 'mongo-driver' });

export interface MongoDriverConfig {
  uri: string;
  database: string;
  maxRows?: number;
  statementTimeoutMs?: number;
}

const ALLOWED_AGGREGATION_STAGES = new Set<string>([
  '$match',
  '$project',
  '$sort',
  '$limit',
  '$skip',
  '$group',
  '$count',
  '$facet',
  '$bucket',
  '$bucketAuto',
  '$unwind',
  '$addFields',
  '$set',
  '$replaceRoot',
  '$replaceWith',
  '$sample',
  '$sortByCount',
  '$redact',
  '$lookup',
  '$graphLookup',
]);

const BLOCKED_OPERATORS = new Set<string>([
  '$where',
  '$function',
  '$accumulator',
  '$expr',
]);

function validateMongoFilter(value: unknown, depth = 0): { valid: boolean; reason?: string } {
  if (depth > 16) return { valid: false, reason: 'Filter too deeply nested' };
  if (value === null || typeof value !== 'object') return { valid: true };

  if (Array.isArray(value)) {
    for (const item of value) {
      const r = validateMongoFilter(item, depth + 1);
      if (!r.valid) return r;
    }
    return { valid: true };
  }

  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (BLOCKED_OPERATORS.has(key)) {
      return { valid: false, reason: `Blocked operator: ${key}` };
    }
    const r = validateMongoFilter(val, depth + 1);
    if (!r.valid) return r;
  }
  return { valid: true };
}

export class MongoDriver implements IReadOnlyDriver {
  readonly type = 'mongodb' as const;
  private client: MongoClient;
  private db: Db;
  private maxRows: number;
  private statementTimeoutMs: number;

  constructor(config: MongoDriverConfig) {
    this.maxRows = config.maxRows ?? 1000;
    this.statementTimeoutMs = config.statementTimeoutMs ?? 30_000;
    this.client = new MongoClient(config.uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: this.statementTimeoutMs,
      appName: 'causeflow-relay',
    });
    this.db = this.client.db(config.database);
  }

  validate(command: DriverCommand): DriverValidation {
    if (command.operation === 'query' || command.operation === 'explain') {
      const collection = command.params['collection'] ?? command.params['tableName'];
      if (typeof collection !== 'string' || !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(collection)) {
        return { valid: false, reason: 'Invalid collection name' };
      }
      const filter = command.params['filter'];
      if (filter !== undefined) {
        const r = validateMongoFilter(filter);
        if (!r.valid) return r;
      }
      const pipeline = command.params['pipeline'];
      if (Array.isArray(pipeline)) {
        for (const stage of pipeline as Document[]) {
          const keys = Object.keys(stage);
          if (keys.length !== 1) {
            return { valid: false, reason: 'Pipeline stage must have exactly one operator' };
          }
          const key = keys[0] as string;
          if (!ALLOWED_AGGREGATION_STAGES.has(key)) {
            return { valid: false, reason: `Aggregation stage ${key} is not allowed` };
          }
          const stageFilterValidation = validateMongoFilter(stage[key]);
          if (!stageFilterValidation.valid) return stageFilterValidation;
        }
      }
    }
    return { valid: true };
  }

  async execute(command: DriverCommand): Promise<DriverResult> {
    const start = Date.now();

    switch (command.operation) {
      case 'list_tables':
        return this.listTables(start);
      case 'describe_table':
        return this.describeTable(command, start);
      case 'query':
        return this.runQuery(command, start);
      case 'explain':
        return this.explain(command, start);
      default:
        throw new Error(`Unknown operation: ${command.operation}`);
    }
  }

  private async listTables(start: number): Promise<DriverResult> {
    const collections = await this.db.listCollections().toArray();
    const rows = await Promise.all(
      collections.map(async (c) => {
        try {
          const count = await this.db.collection(c.name).estimatedDocumentCount();
          return { name: c.name, type: c.type, estimatedCount: count };
        } catch {
          return { name: c.name, type: c.type };
        }
      }),
    );
    return {
      rows,
      rowCount: rows.length,
      executionTimeMs: Date.now() - start,
    };
  }

  private async describeTable(command: DriverCommand, start: number): Promise<DriverResult> {
    const collectionName = (command.params['tableName'] ?? command.params['collection']) as string;
    if (!collectionName) throw new Error('Missing tableName parameter');

    const collection = this.db.collection(collectionName);
    const sampleSize = Number(command.params['sampleSize'] ?? 50);
    const sample = await collection.find().limit(sampleSize).toArray();

    const fieldMap = new Map<string, { types: Set<string>; nullCount: number; totalSeen: number }>();
    for (const doc of sample) {
      for (const [key, value] of Object.entries(doc)) {
        if (!fieldMap.has(key)) {
          fieldMap.set(key, { types: new Set(), nullCount: 0, totalSeen: 0 });
        }
        const entry = fieldMap.get(key)!;
        entry.totalSeen++;
        if (value === null) entry.nullCount++;
        entry.types.add(value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value);
      }
    }

    const indexes = await collection.indexes();

    const schemaRows = Array.from(fieldMap.entries()).map(([name, info]) => ({
      field: name,
      types: Array.from(info.types),
      nullCount: info.nullCount,
      totalSeen: info.totalSeen,
      sparsity: info.totalSeen > 0 ? info.totalSeen / sample.length : 0,
    }));

    const indexRows = indexes.map((idx) => ({
      _type: 'index',
      name: idx.name,
      key: idx.key,
      unique: idx.unique ?? false,
    }));

    return {
      rows: [...schemaRows, ...indexRows],
      rowCount: schemaRows.length + indexRows.length,
      executionTimeMs: Date.now() - start,
    };
  }

  private resolveLimit(params: Record<string, unknown>): number {
    const raw = params['limit'];
    const parsed = typeof raw === 'number' ? Math.floor(raw) : Number.parseInt(String(raw ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return this.maxRows;
    return Math.min(parsed, this.maxRows);
  }

  private async runQuery(command: DriverCommand, start: number): Promise<DriverResult> {
    const collectionName = (command.params['collection'] ?? command.params['tableName']) as string;
    const collection = this.db.collection(collectionName);
    const filter = (command.params['filter'] as Document) ?? {};
    const limit = this.resolveLimit(command.params);
    const pipeline = command.params['pipeline'] as Document[] | undefined;

    if (Array.isArray(pipeline)) {
      const rows = (await collection
        .aggregate(pipeline, { maxTimeMS: this.statementTimeoutMs })
        .limit(limit)
        .toArray()) as Record<string, unknown>[];
      return {
        rows,
        rowCount: rows.length,
        executionTimeMs: Date.now() - start,
      };
    }

    const projection = command.params['projection'] as Document | undefined;
    const sort = command.params['sort'] as Document | undefined;

    const cursor = collection.find(filter, {
      projection,
      limit,
      maxTimeMS: this.statementTimeoutMs,
    });
    if (sort) cursor.sort(sort);
    const rows = (await cursor.toArray()) as Record<string, unknown>[];

    return {
      rows,
      rowCount: rows.length,
      executionTimeMs: Date.now() - start,
    };
  }

  private async explain(command: DriverCommand, start: number): Promise<DriverResult> {
    const collectionName = (command.params['collection'] ?? command.params['tableName']) as string;
    const collection = this.db.collection(collectionName);
    const filter = (command.params['filter'] as Document) ?? {};
    const explanation = await collection.find(filter).explain('executionStats');
    return {
      rows: [explanation as unknown as Record<string, unknown>],
      rowCount: 1,
      executionTimeMs: Date.now() - start,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.db.admin().ping();
      return true;
    } catch {
      return false;
    }
  }

  capabilities(): string[] {
    return ['query', 'describe_table', 'list_tables', 'explain'];
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export const mongoDriverFactory: DriverFactory = {
  type: 'mongodb',
  async create(resource: ResourceConfig, secrets: Record<string, string>): Promise<IReadOnlyDriver> {
    const conn = resource.connection;
    return new MongoDriver({
      uri: secrets['uri'] ?? conn['uri'] ?? '',
      database: secrets['database'] ?? conn['database'] ?? '',
      maxRows: resource.maxRowsPerQuery,
      statementTimeoutMs: resource.statementTimeoutMs,
    });
  },
};

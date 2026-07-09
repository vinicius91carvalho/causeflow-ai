import { MongoClient, type Db, type Document } from 'mongodb';
import type { IReadOnlyDriver, DriverCommand, DriverResult } from '../driver.port.js';
import pino from 'pino';

const logger = pino({ name: 'mongo-driver' });

export interface MongoDriverConfig {
  uri: string;
  database: string;
  maxRows?: number;
}

const BLOCKED_AGGREGATION_STAGES = ['$out', '$merge'];

export class MongoDriver implements IReadOnlyDriver {
  readonly type = 'mongodb' as const;
  private client: MongoClient;
  private db: Db;
  private maxRows: number;

  constructor(config: MongoDriverConfig) {
    this.maxRows = config.maxRows ?? 1000;
    this.client = new MongoClient(config.uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
    });
    this.db = this.client.db(config.database);
  }

  validate(command: DriverCommand): { valid: boolean; reason?: string } {
    if (command.operation === 'query') {
      const pipeline = command.params['pipeline'] as Document[] | undefined;
      if (pipeline) {
        for (const stage of pipeline) {
          const stageKey = Object.keys(stage)[0];
          if (stageKey && BLOCKED_AGGREGATION_STAGES.includes(stageKey)) {
            return { valid: false, reason: `Aggregation stage ${stageKey} is not allowed` };
          }
        }
      }
    }
    return { valid: true };
  }

  async execute(command: DriverCommand): Promise<DriverResult> {
    const start = Date.now();

    switch (command.operation) {
      case 'list_tables': {
        const collections = await this.db.listCollections().toArray();
        return {
          rows: collections.map((c) => ({ name: c.name, type: c.type })),
          rowCount: collections.length,
          executionTimeMs: Date.now() - start,
        };
      }

      case 'describe_table': {
        const collectionName = command.params['tableName'] as string;
        if (!collectionName) throw new Error('Missing tableName parameter');

        const collection = this.db.collection(collectionName);
        const sample = await collection.find().limit(10).toArray();

        // Infer schema from sample documents
        const fieldMap = new Map<string, Set<string>>();
        for (const doc of sample) {
          for (const [key, value] of Object.entries(doc)) {
            if (!fieldMap.has(key)) fieldMap.set(key, new Set());
            fieldMap.get(key)!.add(typeof value);
          }
        }

        const indexes = await collection.indexes();

        const schemaRows = Array.from(fieldMap.entries()).map(([name, types]) => ({
          field: name,
          types: Array.from(types),
        }));

        return {
          rows: [...schemaRows, ...indexes.map((idx) => ({ _type: 'index', name: idx.name, key: idx.key }))],
          rowCount: schemaRows.length + indexes.length,
          executionTimeMs: Date.now() - start,
        };
      }

      case 'query': {
        const collectionName = command.params['collection'] as string ?? command.params['tableName'] as string;
        if (!collectionName) throw new Error('Missing collection parameter');

        const collection = this.db.collection(collectionName);
        const filter = (command.params['filter'] as Document) ?? {};
        const sql = command.params['sql'] as string | undefined;
        const limit = Math.min(
          (command.params['limit'] as number) ?? this.maxRows,
          this.maxRows,
        );

        // Support JSON filter directly or parse simple SQL-like syntax
        let query: Document = filter;
        if (sql && Object.keys(filter).length === 0) {
          try {
            query = JSON.parse(sql);
          } catch {
            query = {};
          }
        }

        // MongoDB interprets .limit(0) as "no limit", so we special-case it.
        const rows = limit === 0
          ? []
          : await collection.find(query).limit(limit).toArray();

        return {
          rows: rows as Record<string, unknown>[],
          rowCount: rows.length,
          executionTimeMs: Date.now() - start,
        };
      }

      case 'explain': {
        const collectionName = command.params['collection'] as string ?? command.params['tableName'] as string;
        if (!collectionName) throw new Error('Missing collection parameter');

        const collection = this.db.collection(collectionName);
        const filter = (command.params['filter'] as Document) ?? {};
        const explanation = await collection.find(filter).explain('executionStats');

        return {
          rows: [explanation as unknown as Record<string, unknown>],
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

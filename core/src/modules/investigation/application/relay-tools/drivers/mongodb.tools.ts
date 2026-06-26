import { z } from 'zod';
import { defineToolSpec } from '../tool-spec.js';
import type { AnyToolSpec } from '../tool-spec.js';

const mongoListCollections = defineToolSpec({
    name: 'mongodb_list_collections',
    driverType: 'mongodb',
    operation: 'list_tables',
    description: 'List collections in a MongoDB resource, with estimated document counts.',
    inputSchema: z.object({ resourceId: z.string() }),
    buildCommand: ({ resourceId }) => ({ resourceId, operation: 'list_tables', params: {} }),
    maxResultChars: 10_000,
});

const mongoDescribeCollection = defineToolSpec({
    name: 'mongodb_describe_collection',
    driverType: 'mongodb',
    operation: 'describe_table',
    description: 'Infer a MongoDB collection schema by sampling documents, plus index catalog. Use sampleSize to control cost (default 50).',
    inputSchema: z.object({
        resourceId: z.string(),
        collection: z.string(),
        sampleSize: z.number().int().positive().max(500).default(50).optional(),
    }),
    buildCommand: ({ resourceId, collection, sampleSize }) => ({
        resourceId,
        operation: 'describe_table',
        params: { tableName: collection, sampleSize },
    }),
    maxResultChars: 15_000,
});

const mongoFind = defineToolSpec({
    name: 'mongodb_find',
    driverType: 'mongodb',
    operation: 'query',
    description: `Run a find on a MongoDB collection. Use "filter" for standard queries; operators like $where, $function, $accumulator, $expr are blocked.

Examples:
- Stale cache: filter = { "updatedAt": { "$lt": { "$date": "2025-04-01T00:00:00Z" } } }
- Missing field: filter = { "email": { "$exists": false } }`,
    inputSchema: z.object({
        resourceId: z.string(),
        collection: z.string(),
        filter: z.record(z.unknown()).default({}).describe('Mongo query operator document. Blocked operators: $where, $function, $accumulator, $expr'),
        projection: z.record(z.unknown()).optional(),
        sort: z.record(z.unknown()).optional(),
        limit: z.number().int().positive().max(1000).default(100),
    }),
    buildCommand: ({ resourceId, collection, filter, projection, sort, limit }) => ({
        resourceId,
        operation: 'query',
        params: { collection, filter, projection, sort, limit },
    }),
    maxResultChars: 30_000,
});

const mongoAggregate = defineToolSpec({
    name: 'mongodb_aggregate',
    driverType: 'mongodb',
    operation: 'query',
    description: `Run a safe aggregation pipeline. Allowed stages: $match, $project, $sort, $limit, $skip, $group, $count, $facet, $bucket, $bucketAuto, $unwind, $addFields, $set, $replaceRoot, $replaceWith, $sample, $sortByCount, $redact, $lookup, $graphLookup. Writing stages ($out, $merge) and JS-exec stages are blocked.`,
    inputSchema: z.object({
        resourceId: z.string(),
        collection: z.string(),
        pipeline: z.array(z.record(z.unknown())).describe('Each element is a single-key operator doc, e.g. { "$match": {...} }'),
        limit: z.number().int().positive().max(1000).default(100),
    }),
    buildCommand: ({ resourceId, collection, pipeline, limit }) => ({
        resourceId,
        operation: 'query',
        params: { collection, pipeline, limit },
    }),
    maxResultChars: 30_000,
});

export const MONGODB_TOOLS = [mongoListCollections, mongoDescribeCollection, mongoFind, mongoAggregate] as unknown as readonly AnyToolSpec[];

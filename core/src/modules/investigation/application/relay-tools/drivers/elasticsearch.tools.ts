import { z } from 'zod';
import { defineToolSpec } from '../tool-spec.js';
import type { AnyToolSpec } from '../tool-spec.js';

const esListIndices = defineToolSpec({
    name: 'elasticsearch_list_indices',
    driverType: 'elasticsearch',
    operation: 'list_tables',
    description: 'List indices in an Elasticsearch/OpenSearch cluster (_cat/indices).',
    inputSchema: z.object({ resourceId: z.string() }),
    buildCommand: ({ resourceId }) => ({ resourceId, operation: 'list_tables', params: {} }),
    maxResultChars: 15_000,
});

const esMapping = defineToolSpec({
    name: 'elasticsearch_mapping',
    driverType: 'elasticsearch',
    operation: 'describe_table',
    description: 'Fetch the field mapping for an Elasticsearch index — field names and analyzers.',
    inputSchema: z.object({ resourceId: z.string(), index: z.string() }),
    buildCommand: ({ resourceId, index }) => ({ resourceId, operation: 'describe_table', params: { tableName: index } }),
    maxResultChars: 15_000,
});

const esSearch = defineToolSpec({
    name: 'elasticsearch_search',
    driverType: 'elasticsearch',
    operation: 'query',
    description: `Run a search against an Elasticsearch index. Body is validated against an allowlist of keys: query, size, from, sort, aggs, _source, script_fields, fields, highlight, track_total_hits, timeout.

Examples:
- Recent errors: body = { "query": { "bool": { "must": [{"match": {"level": "ERROR"}}] } }, "sort": [{"@timestamp": "desc"}] }
- Log volume per minute: body = { "aggs": { "per_min": { "date_histogram": { "field": "@timestamp", "fixed_interval": "1m" } } } }`,
    inputSchema: z.object({
        resourceId: z.string(),
        index: z.string(),
        body: z.record(z.unknown()).describe('ES search body. Only allowlisted top-level keys permitted.'),
        size: z.number().int().positive().max(1000).default(100).optional(),
    }),
    buildCommand: ({ resourceId, index, body, size }) => ({
        resourceId,
        operation: 'query',
        params: { index, body, size },
    }),
    maxResultChars: 30_000,
});

export const ELASTICSEARCH_TOOLS = [esListIndices, esMapping, esSearch] as unknown as readonly AnyToolSpec[];

import { z } from 'zod';
import { defineToolSpec } from '../tool-spec.js';
import type { AnyToolSpec } from '../tool-spec.js';

const promList = defineToolSpec({
    name: 'prometheus_list_metrics',
    driverType: 'prometheus',
    operation: 'list_tables',
    description: 'List all metric names available in the Prometheus resource (label values of __name__).',
    inputSchema: z.object({ resourceId: z.string() }),
    buildCommand: ({ resourceId }) => ({ resourceId, operation: 'list_tables', params: {} }),
    maxResultChars: 15_000,
});

const promInstant = defineToolSpec({
    name: 'prometheus_query',
    driverType: 'prometheus',
    operation: 'query',
    description: `Instant PromQL query at optional timestamp. Use for point-in-time checks (e.g. current error rate, saturation).

Examples:
- Error ratio: "sum(rate(http_requests_total{status=~\\"5..\\"}[5m])) / sum(rate(http_requests_total[5m]))"
- Pods above memory limit: "count(container_memory_usage_bytes > container_spec_memory_limit_bytes) by (pod)"`,
    inputSchema: z.object({
        resourceId: z.string(),
        query: z.string(),
        time: z.union([z.string(), z.number()]).optional().describe('Unix seconds or RFC3339. Default: now'),
    }),
    buildCommand: ({ resourceId, query, time }) => ({
        resourceId,
        operation: 'query',
        params: { query, time },
    }),
    maxResultChars: 20_000,
});

const promRange = defineToolSpec({
    name: 'prometheus_query_range',
    driverType: 'prometheus',
    operation: 'query_range',
    description: 'Range PromQL query — gives you a time series between start and end. Use this to build a timeline of the incident (p95 latency over last hour, error rate leading up to the page).',
    inputSchema: z.object({
        resourceId: z.string(),
        query: z.string(),
        start: z.union([z.string(), z.number()]),
        end: z.union([z.string(), z.number()]),
        step: z.string().default('60s').describe('Resolution, e.g. "15s", "1m", "5m"'),
    }),
    buildCommand: ({ resourceId, query, start, end, step }) => ({
        resourceId,
        operation: 'query_range',
        params: { query, start, end, step },
    }),
    maxResultChars: 25_000,
});

export const PROMETHEUS_TOOLS = [promList, promInstant, promRange] as unknown as readonly AnyToolSpec[];

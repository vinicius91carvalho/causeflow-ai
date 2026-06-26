import { z } from 'zod';
import { defineToolSpec } from '../tool-spec.js';
import type { AnyToolSpec } from '../tool-spec.js';

const cwListLogGroups = defineToolSpec({
    name: 'cloudwatch_list_log_groups',
    driverType: 'cloudwatch',
    operation: 'list_tables',
    description: 'List CloudWatch Log Groups reachable via this resource.',
    inputSchema: z.object({ resourceId: z.string() }),
    buildCommand: ({ resourceId }) => ({ resourceId, operation: 'list_tables', params: {} }),
    maxResultChars: 20_000,
});

const cwInsights = defineToolSpec({
    name: 'cloudwatch_insights_query',
    driverType: 'cloudwatch',
    operation: 'query',
    description: `Run a CloudWatch Logs Insights query against a log group. This is the right tool for "what errors showed up in the last hour" or "find the first 500 for POST /checkout".

Examples:
- Errors last hour: query = "fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 200"
- p95 latency: query = "stats pct(latency_ms, 95) by bin(1m) | filter @logStream like /api/"`,
    inputSchema: z.object({
        resourceId: z.string(),
        logGroup: z.string().describe('Full CloudWatch log group name'),
        query: z.string().describe('CloudWatch Logs Insights query'),
        startTime: z.number().optional().describe('Unix seconds (default: 1 hour ago)'),
        endTime: z.number().optional().describe('Unix seconds (default: now)'),
        timeoutMs: z.number().int().positive().max(60_000).default(30_000).optional(),
    }),
    buildCommand: ({ resourceId, logGroup, query, startTime, endTime, timeoutMs }) => ({
        resourceId,
        operation: 'query',
        params: { logGroup, query, startTime, endTime, timeoutMs },
    }),
    maxResultChars: 30_000,
});

export const CLOUDWATCH_TOOLS = [cwListLogGroups, cwInsights] as unknown as readonly AnyToolSpec[];

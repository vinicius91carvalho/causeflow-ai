import { z } from 'zod';
import { defineToolSpec } from '../tool-spec.js';
import type { AnyToolSpec } from '../tool-spec.js';

const REDIS_ALLOWED_COMMANDS = [
    'GET', 'MGET', 'EXISTS', 'TYPE', 'TTL', 'PTTL',
    'HGET', 'HGETALL', 'HMGET', 'HEXISTS', 'HKEYS', 'HVALS', 'HLEN',
    'LLEN', 'LINDEX', 'LRANGE',
    'SMEMBERS', 'SISMEMBER', 'SCARD',
    'ZRANGE', 'ZREVRANGE', 'ZRANGEBYSCORE', 'ZCARD', 'ZSCORE',
    'OBJECT', 'DEBUG', 'INFO', 'DBSIZE', 'CLIENT',
] as const;

const redisKeys = defineToolSpec({
    name: 'redis_keys',
    driverType: 'redis',
    operation: 'describe_table',
    description: 'Scan keys matching a pattern in a Redis resource. Use narrow patterns (e.g. "user:*") to avoid broad scans. Returns up to maxRowsPerQuery keys with their type.',
    inputSchema: z.object({
        resourceId: z.string(),
        pattern: z.string().default('*').describe('MATCH pattern, e.g. "session:*" or "cache:user:*"'),
    }),
    buildCommand: ({ resourceId, pattern }) => ({
        resourceId,
        operation: 'describe_table',
        params: { pattern },
    }),
    maxResultChars: 15_000,
});

const redisCall = defineToolSpec({
    name: 'redis_call',
    driverType: 'redis',
    operation: 'query',
    description: `Execute a read-only Redis command. Allowed: ${REDIS_ALLOWED_COMMANDS.join(', ')}. Writing commands (SET, DEL, EXPIRE, FLUSH*) are blocked at the relay.

Examples:
- GET a cached value: { command: "GET", args: ["user:123:profile"] }
- Hash read: { command: "HGETALL", args: ["session:abc"] }
- Sorted set range: { command: "ZRANGE", args: ["leaderboard", "0", "10", "WITHSCORES"] }`,
    inputSchema: z.object({
        resourceId: z.string(),
        command: z.enum(REDIS_ALLOWED_COMMANDS),
        args: z.array(z.string()).default([]),
    }),
    buildCommand: ({ resourceId, command, args }) => ({
        resourceId,
        operation: 'query',
        params: { command, args },
    }),
    maxResultChars: 15_000,
});

const redisInfo = defineToolSpec({
    name: 'redis_info',
    driverType: 'redis',
    operation: 'list_tables',
    description: 'INFO keyspace for a Redis resource — database index, key count, bytes. Good for "how big is this cache" questions.',
    inputSchema: z.object({ resourceId: z.string() }),
    buildCommand: ({ resourceId }) => ({ resourceId, operation: 'list_tables', params: {} }),
    maxResultChars: 5_000,
});

export const REDIS_TOOLS = [redisKeys, redisCall, redisInfo] as unknown as readonly AnyToolSpec[];

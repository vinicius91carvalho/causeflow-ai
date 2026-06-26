import { z } from 'zod';
import { defineToolSpec } from '../tool-spec.js';
import type { AnyToolSpec } from '../tool-spec.js';

const httpRequest = defineToolSpec({
    name: 'http_request',
    driverType: 'http',
    operation: 'query',
    description: `GET or HEAD a path on an internal HTTP resource. Paths are validated against an allowlist configured on the relay — requests to non-allowed paths are rejected. Use this to inspect internal service health endpoints, API responses, or config dumps that the investigation team has exposed for diagnosis.

Examples:
- Health probe: { path: "/healthz" }
- Service info: { path: "/api/v1/status", method: "GET" }`,
    inputSchema: z.object({
        resourceId: z.string(),
        path: z.string().describe('Path on the HTTP resource base URL'),
        method: z.enum(['GET', 'HEAD']).default('GET'),
        query: z.record(z.string()).optional().describe('Query-string parameters as string map'),
    }),
    buildCommand: ({ resourceId, path, method, query }) => ({
        resourceId,
        operation: 'query',
        params: { path, method, query },
    }),
    maxResultChars: 20_000,
});

export const HTTP_TOOLS = [httpRequest] as unknown as readonly AnyToolSpec[];

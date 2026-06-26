import { z } from 'zod';
import { defineToolSpec } from '../tool-spec.js';
import type { AnyToolSpec } from '../tool-spec.js';

const k8sListApis = defineToolSpec({
    name: 'kubernetes_list_api_resources',
    driverType: 'kubernetes',
    operation: 'list_tables',
    description: 'List the API resources visible to the relay service account in the Kubernetes cluster.',
    inputSchema: z.object({ resourceId: z.string() }),
    buildCommand: ({ resourceId }) => ({ resourceId, operation: 'list_tables', params: {} }),
    maxResultChars: 15_000,
});

const k8sGet = defineToolSpec({
    name: 'kubernetes_get',
    driverType: 'kubernetes',
    operation: 'query',
    description: `Get a Kubernetes resource by kind (+ optional namespace, name). verb is one of get/list/watch — writing verbs are blocked.

Examples:
- List failing pods: { kind: "pod", namespace: "prod", verb: "list" }
- Describe a specific service: { kind: "service", namespace: "prod", name: "api", verb: "get" }`,
    inputSchema: z.object({
        resourceId: z.string(),
        kind: z.string().describe('Resource kind (case-insensitive). Examples: pod, deployment, service, configmap, node, event'),
        namespace: z.string().optional(),
        name: z.string().optional(),
        verb: z.enum(['get', 'list', 'watch']).default('list'),
    }),
    buildCommand: ({ resourceId, kind, namespace, name, verb }) => ({
        resourceId,
        operation: 'query',
        params: { kind, namespace, name, verb },
    }),
    maxResultChars: 30_000,
});

export const KUBERNETES_TOOLS = [k8sListApis, k8sGet] as unknown as readonly AnyToolSpec[];

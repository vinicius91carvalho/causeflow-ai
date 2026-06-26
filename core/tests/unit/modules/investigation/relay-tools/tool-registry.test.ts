import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { RelayToolRegistry } from '../../../../../src/modules/investigation/application/relay-tools/tool-registry.js';
import type { AnyToolSpec } from '../../../../../src/modules/investigation/application/relay-tools/tool-spec.js';
import type { IRelayGateway, RelayResource, RelayQueryResult } from '../../../../../src/shared/application/ports/relay-gateway.port.js';
import { RelayGatewayError } from '../../../../../src/shared/application/ports/relay-gateway.port.js';
import { tenantId as toTenantId } from '../../../../../src/shared/domain/value-objects.js';

const makeSpec = (overrides: Partial<AnyToolSpec> = {}): AnyToolSpec => ({
    name: 'test_tool',
    driverType: 'postgres',
    operation: 'query',
    description: 'Test tool',
    inputSchema: z.object({ resourceId: z.string(), sql: z.string() }),
    buildCommand: ({ resourceId, sql }: { resourceId: string; sql: string }) => ({
        resourceId,
        operation: 'query',
        params: { sql },
    }),
    ...overrides,
});

const makeGateway = (overrides: Partial<IRelayGateway> = {}): IRelayGateway => ({
    isConnected: () => true,
    listResources: async () => [],
    execute: async () => ({ rows: [], rowCount: 0, executionTimeMs: 0, masked: false, maskedFieldCount: 0 }),
    describeResource: async () => ({ tables: [], type: '', database: '' }),
    ...overrides,
});

describe('RelayToolRegistry', () => {
    it('registers specs and exposes ToolDefinitions', () => {
        const r = new RelayToolRegistry();
        r.register(makeSpec());
        const defs = r.getAllToolDefinitions();
        expect(defs).toHaveLength(1);
        expect(defs[0]!.name).toBe('test_tool');
        expect(defs[0]!.inputSchema).toMatchObject({ type: 'object' });
    });

    it('rejects duplicate names', () => {
        const r = new RelayToolRegistry();
        r.register(makeSpec());
        expect(() => r.register(makeSpec())).toThrow(/Duplicate/);
    });

    it('filters by connected resource types', () => {
        const r = new RelayToolRegistry();
        r.register(makeSpec({ name: 'pg_tool', driverType: 'postgres' }));
        r.register(makeSpec({ name: 'redis_tool', driverType: 'redis' }));
        r.register(makeSpec({ name: 'k8s_tool', driverType: 'kubernetes' }));

        const filtered = r.getToolDefinitionsForResources([
            { resourceId: 'x', type: 'postgres', name: 'x', database: '', readOnly: true },
        ] as RelayResource[]);
        expect(filtered.map((t) => t.name)).toEqual(['pg_tool']);
    });

    it('handler validates input with Zod and returns validation_failed envelope', async () => {
        const r = new RelayToolRegistry();
        r.register(makeSpec());
        const handler = r.createHandler({ relayGateway: makeGateway(), tenantId: toTenantId('t1') });
        const result = await handler('test_tool', { resourceId: 'x' });
        const parsed = JSON.parse(result) as { status: string };
        expect(parsed.status).toBe('validation_failed');
    });

    it('handler dispatches to gateway and wraps success', async () => {
        const r = new RelayToolRegistry();
        r.register(makeSpec());
        const gateway = makeGateway({
            execute: async () => ({
                rows: [{ id: 1 }],
                rowCount: 1,
                executionTimeMs: 5,
                masked: true,
                maskedFieldCount: 2,
                detections: [{ detector: 'email', count: 2 }],
            } satisfies RelayQueryResult),
        });
        const handler = r.createHandler({ relayGateway: gateway, tenantId: toTenantId('t1') });
        const out = await handler('test_tool', { resourceId: 'res', sql: 'SELECT 1' });
        const parsed = JSON.parse(out) as { status: string; rowCount: number; masking: { detections: Array<{ detector: string; count: number }> } };
        expect(parsed.status).toBe('ok');
        expect(parsed.rowCount).toBe(1);
        expect(parsed.masking.detections[0]).toEqual({ detector: 'email', count: 2 });
    });

    it('handler maps RelayGatewayError to envelopes', async () => {
        const r = new RelayToolRegistry();
        r.register(makeSpec());
        const gateway = makeGateway({
            execute: async () => {
                throw new RelayGatewayError('rate limit', 'rate_limited', -32010, true);
            },
        });
        const handler = r.createHandler({ relayGateway: gateway, tenantId: toTenantId('t1') });
        const out = await handler('test_tool', { resourceId: 'res', sql: 'SELECT 1' });
        const parsed = JSON.parse(out) as { status: string; retriable: boolean };
        expect(parsed.status).toBe('rate_limited');
        expect(parsed.retriable).toBe(true);
    });

    it('handler returns approval_pending when result flags it', async () => {
        const r = new RelayToolRegistry();
        r.register(makeSpec());
        const gateway = makeGateway({
            execute: async () => ({
                rows: [], rowCount: 0, executionTimeMs: 0, masked: false, maskedFieldCount: 0,
                requiresApproval: true,
            }),
        });
        const handler = r.createHandler({ relayGateway: gateway, tenantId: toTenantId('t1') });
        const out = await handler('test_tool', { resourceId: 'res', sql: 'SELECT 1' });
        const parsed = JSON.parse(out) as { status: string };
        expect(parsed.status).toBe('approval_pending');
    });
});

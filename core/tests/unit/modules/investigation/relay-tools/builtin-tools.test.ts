import { describe, it, expect } from 'vitest';
import { buildDefaultRelayToolRegistry, LIST_RELAY_RESOURCES_TOOL, buildStaticRelayToolDefinitions } from '../../../../../src/modules/investigation/application/relay-tools/index.js';

describe('default relay tool registry', () => {
    const registry = buildDefaultRelayToolRegistry();

    it('registers all 9 driver toolsets', () => {
        const types = new Set(registry.list().map((t) => t.driverType));
        expect(types).toEqual(new Set([
            'postgres', 'mysql', 'mongodb', 'redis',
            'elasticsearch', 'http', 'prometheus', 'cloudwatch', 'kubernetes',
        ]));
    });

    it('all tool names are unique and well-formed', () => {
        const names = registry.list().map((t) => t.name);
        expect(new Set(names).size).toBe(names.length);
        for (const name of names) {
            expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
        }
    });

    it('produces JSON-Schema compatible tool definitions', () => {
        for (const def of registry.getAllToolDefinitions()) {
            expect(def.name).toBeTruthy();
            expect(def.description.length).toBeGreaterThan(10);
            expect(def.inputSchema).toMatchObject({ type: 'object' });
        }
    });

    it('includes list_relay_resources meta tool at the top', () => {
        const defs = buildStaticRelayToolDefinitions(registry);
        expect(defs[0]!.name).toBe(LIST_RELAY_RESOURCES_TOOL.name);
    });

    it('every spec has at least one required field', () => {
        for (const spec of registry.list()) {
            expect(spec.description.length).toBeGreaterThan(10);
            expect(spec.name).toContain(spec.driverType);
        }
    });
});

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ToolDefinition } from '../../../../shared/application/ports/agent-runner.port.js';
import type { IRelayGateway, RelayResource } from '../../../../shared/application/ports/relay-gateway.port.js';
import type { TenantId } from '../../../../shared/domain/value-objects.js';
import type { AnyToolSpec } from './tool-spec.js';
import { wrapRelayError, wrapRelaySuccess } from './response-handler.js';

/**
 * Central registry for relay-backed tools.
 *
 * Collect driver-specific specs, produce `ToolDefinition[]` for the agent,
 * and a unified handler that validates + dispatches + wraps every call.
 *
 * Add a new driver: write `drivers/<name>.tools.ts` exporting a `TOOLS` array,
 * then register it in `index.ts`. Zero changes elsewhere.
 */
export class RelayToolRegistry {
    private specs = new Map<string, AnyToolSpec>();

    register(spec: AnyToolSpec): void {
        if (this.specs.has(spec.name)) {
            throw new Error(`Duplicate relay tool name: ${spec.name}`);
        }
        this.specs.set(spec.name, spec);
    }

    registerAll(specs: readonly AnyToolSpec[]): void {
        for (const spec of specs) this.register(spec);
    }

    list(): AnyToolSpec[] {
        return Array.from(this.specs.values());
    }

    has(name: string): boolean {
        return this.specs.has(name);
    }

    get(name: string): AnyToolSpec | undefined {
        return this.specs.get(name);
    }

    /** All tools as ToolDefinition — pass to the agent runner as-is */
    getAllToolDefinitions(): ToolDefinition[] {
        return this.list().map(toToolDefinition);
    }

    /**
     * Return only the tools whose `driverType` matches one of the
     * connected resources. Keeps the LLM context tight by hiding tools
     * that can't be satisfied in the current tenant.
     */
    getToolDefinitionsForResources(resources: readonly RelayResource[]): ToolDefinition[] {
        const connectedTypes = new Set(resources.map((r) => r.type));
        return this.list()
            .filter((spec) => connectedTypes.has(spec.driverType))
            .map(toToolDefinition);
    }

    /** Ship-ready handler usable as the `toolHandler` argument for the agent runner */
    createHandler(deps: RelayToolHandlerDeps): (name: string, input: Record<string, unknown>) => Promise<string> {
        return async (name, input) => {
            const spec = this.specs.get(name);
            if (!spec) throw new Error(`Unknown relay tool: ${name}`);

            let parsed: unknown;
            try {
                parsed = spec.inputSchema.parse(input);
            } catch (err) {
                return JSON.stringify({
                    status: 'validation_failed',
                    reason: err instanceof z.ZodError ? err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : String(err),
                    retriable: false,
                    hint: 'Fix the tool input per the schema described in the tool description.',
                });
            }

            try {
                const command = spec.buildCommand(parsed);
                const result = await deps.relayGateway.execute(deps.tenantId, command);
                if (spec.formatResult) {
                    const custom = spec.formatResult(result, parsed);
                    return JSON.stringify(custom);
                }
                return JSON.stringify(wrapRelaySuccess(result));
            } catch (err) {
                return JSON.stringify(wrapRelayError(err));
            }
        };
    }
}

export interface RelayToolHandlerDeps {
    relayGateway: IRelayGateway;
    tenantId: TenantId;
}

function toToolDefinition(spec: AnyToolSpec): ToolDefinition {
    // Cast to ZodType — zodToJsonSchema is typed to accept a narrower
    // `ZodType` but AnyToolSpec uses `ZodTypeAny` for collection-friendliness.
    const jsonSchema = zodToJsonSchema(spec.inputSchema as unknown as Parameters<typeof zodToJsonSchema>[0]);
    const { $schema: _discardedSchema, ...rest } = jsonSchema as Record<string, unknown>;
    void _discardedSchema;
    return {
        name: spec.name,
        description: spec.description,
        inputSchema: rest,
        maxResultChars: spec.maxResultChars,
        isConcurrencySafe: spec.isConcurrencySafe ?? true,
    };
}

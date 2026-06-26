import type { z } from 'zod';
import type { RelayCommand, RelayQueryResult } from '../../../../shared/application/ports/relay-gateway.port.js';

/**
 * Declarative spec for a relay-backed agent tool.
 *
 * One spec = one tool exposed to the LLM. The registry converts each spec
 * into a `ToolDefinition` (consumed by the Mastra tool adapter) and a
 * handler that validates input, builds the RPC command, and wraps the
 * relay response with masking/approval/error handling.
 */
export interface ToolSpec<Input extends z.ZodTypeAny = z.ZodTypeAny> {
    /** Tool name exposed to the LLM (should be stable — LLM may reference it across turns) */
    name: string;

    /** Human/LLM-readable description. Aim for specific, concrete examples */
    description: string;

    /**
     * Relay driver type this tool maps to. Used for dynamic filtering:
     * when no resource of this type is connected, the tool is hidden.
     */
    driverType: string;

    /** RPC operation to invoke on the relay driver */
    operation: string;

    /** Zod schema for tool input validation */
    inputSchema: Input;

    /** Max characters in the result string before truncation. Default 30_000 */
    maxResultChars?: number;

    /** Can this tool run concurrently with other tools? Default true */
    isConcurrencySafe?: boolean;

    /**
     * Translate validated input into the RelayCommand sent over JSON-RPC.
     * Must produce `{ resourceId, operation, params }` consumed by the relay.
     */
    buildCommand: (input: z.infer<Input>) => RelayCommand;

    /**
     * Optional custom result formatter. If omitted, the registry stringifies
     * the masked rows with detection sidecar metadata.
     */
    formatResult?: (result: RelayQueryResult, input: z.infer<Input>) => unknown;
}

/**
 * Any spec — used as a collection type since each spec parametrizes its
 * own input schema.
 */
export type AnyToolSpec = ToolSpec<z.ZodTypeAny>;

/**
 * Identity helper that preserves the concrete `Input` generic when a spec
 * is written inline with an object literal. Without this, writing
 * `const spec: AnyToolSpec = { ... }` widens `Input` to `ZodTypeAny`,
 * which propagates `any` into `buildCommand` and `formatResult` parameters
 * (tripping `no-unsafe-assignment`). With the helper, TS infers `Input`
 * from the `inputSchema` field so callback parameters stay strongly typed.
 *
 * Usage:
 *   const mySpec = defineToolSpec({
 *     name: '...', inputSchema: z.object({ id: z.string() }),
 *     buildCommand: ({ id }) => ({ resourceId: id, operation: 'x', params: {} }),
 *   });
 */
export function defineToolSpec<Input extends z.ZodTypeAny>(
    spec: ToolSpec<Input>,
): ToolSpec<Input> {
    return spec;
}

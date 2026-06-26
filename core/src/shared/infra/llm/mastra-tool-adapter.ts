/**
 * Converts CauseFlow ToolDefinition[] + toolHandler into Mastra tool objects.
 *
 * This adapter bridges all existing tools (aws_api_call, memory, GitHub,
 * CodeCommit, Composio, DB) with Mastra's Agent without modification.
 */
import { createTool } from '@mastra/core/tools';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { z } from 'zod';
import type { ToolDefinition, ToolCallRecord, ToolCallTrackerPort } from '../../application/ports/agent-runner.port.js';

const DEFAULT_MAX_RESULT_CHARS = 50_000;

function truncateResult(result: string, maxChars: number): { text: string; wasTruncated: boolean } {
    if (result.length <= maxChars) return { text: result, wasTruncated: false };
    return {
        text: result.slice(0, maxChars) +
            `\n\n[TRUNCATED: showing first ${maxChars.toLocaleString()} of ${result.length.toLocaleString()} chars]`,
        wasTruncated: true,
    };
}

/**
 * Convert a JSON Schema object to a Zod schema.
 * Handles the common patterns used in CauseFlow tool definitions.
 */
function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodTypeAny {
    if (schema['type'] !== 'object' || !schema['properties']) {
        return z.record(z.unknown());
    }

    const properties = schema['properties'] as Record<string, Record<string, unknown>>;
    const required = new Set((schema['required'] as string[]) ?? []);
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [key, prop] of Object.entries(properties)) {
        let field: z.ZodTypeAny;
        const propType = prop['type'] as string;
        const description = prop['description'] as string | undefined;

        switch (propType) {
            case 'string':
                field = z.string();
                break;
            case 'number':
            case 'integer':
                field = z.number();
                break;
            case 'boolean':
                field = z.boolean();
                break;
            case 'array':
                field = z.array(z.unknown());
                break;
            case 'object':
                field = z.record(z.unknown());
                break;
            default:
                field = z.unknown();
        }

        if (description) {
            field = field.describe(description);
        }

        if (!required.has(key)) {
            field = field.optional();
        }

        shape[key] = field;
    }

    return z.object(shape);
}

export interface ToolAdapterResult {
    tools: Record<string, ReturnType<typeof createTool>>;
    /** Call after agent completes to get the full tool call log */
    getToolCalls(): ToolCallRecord[];
    getTruncatedCount(): number;
}

/**
 * Convert CauseFlow tool definitions + handler into Mastra tools.
 */
export function adaptToolsForMastra(
    toolDefs: ToolDefinition[],
    toolHandler: (name: string, input: Record<string, unknown>) => Promise<string>,
    onToolCall?: (toolName: string, input: Record<string, unknown>) => void,
    tracker?: ToolCallTrackerPort,
): ToolAdapterResult {
    const toolCallLog: ToolCallRecord[] = [];
    let truncatedCount = 0;

    const tools: Record<string, ReturnType<typeof createTool>> = {};

    // Tools that should NOT carry a citation header: cite_evidence itself
    // (recursive noise) and UI flow-control tools whose output is not data.
    const SKIP_HEADER = new Set(['cite_evidence', 'request_confirmation', 'request_context', 'report_finding']);

    for (const def of toolDefs) {
        const maxChars = def.maxResultChars ?? DEFAULT_MAX_RESULT_CHARS;
        const inputSchema = jsonSchemaToZod(def.inputSchema);

        tools[def.name] = createTool({
            id: def.name,
            description: def.description,
            inputSchema,
            execute: async (input) => {
                const rawInput = input as Record<string, unknown>;
                onToolCall?.(def.name, rawInput);
                try {
                    const rawResult = await toolHandler(def.name, rawInput);
                    const { text, wasTruncated } = truncateResult(rawResult, maxChars);
                    if (wasTruncated) truncatedCount++;
                    let id: string | undefined;
                    if (tracker && !SKIP_HEADER.has(def.name)) {
                        id = tracker.register(def.name, rawInput, text);
                    }
                    toolCallLog.push({ id, name: def.name, input: rawInput, output: text });
                    return id ? `[toolCallId=${id}]\n${text}` : text;
                } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    const span = trace.getActiveSpan();
                    if (span) {
                        const category = errorMsg.match(/failed \(([a-z_]+)\)/)?.[1] ?? 'unknown';
                        span.recordException(err instanceof Error ? err : new Error(errorMsg));
                        span.setStatus({ code: SpanStatusCode.ERROR, message: errorMsg.slice(0, 500) });
                        span.setAttribute('tool.error.category', category);
                    }
                    const output = `Tool \`${def.name}\` failed: ${errorMsg}`;
                    toolCallLog.push({ name: def.name, input: rawInput, output });
                    return output;
                }
            },
        });
    }

    return {
        tools,
        getToolCalls: () => toolCallLog,
        getTruncatedCount: () => truncatedCount,
    };
}

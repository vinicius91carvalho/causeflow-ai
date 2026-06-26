/**
 * Tool Error Formatting
 *
 * Inspired by quacode's toolErrors.ts.
 * Enhanced with Hindsight: when a tool error matches a pattern seen before,
 * we recall the past resolution and include it in the error message.
 *
 * This helps the LLM:
 * 1. Understand what went wrong (structured error vs raw stack trace)
 * 2. Know how to recover (retry with different params, use fallback tool)
 * 3. Learn from past errors (Hindsight recall)
 */
import type { ZodIssue } from 'zod';
import { ZodError } from 'zod';
import type { AgentMemory } from '../../../../shared/application/ports/agent-memory.port.js';

const MAX_ERROR_LENGTH = 10_000;
const TRUNCATION_KEEP_CHARS = 4_000;

// --- Error Classification ---

export type ErrorCategory =
    | 'validation'      // Zod/schema validation errors
    | 'auth'            // 401/403 credential errors
    | 'rate_limit'      // 429 throttling
    | 'not_found'       // Resource not found
    | 'timeout'         // Operation timed out
    | 'service_error'   // 5xx from external service
    | 'unknown';

export function classifyError(error: unknown): ErrorCategory {
    if (error instanceof ZodError) return 'validation';
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        const errorWithStatus = error as Error & { status?: number; statusCode?: number };
        const status = errorWithStatus.status ?? errorWithStatus.statusCode;
        if (status === 401 || status === 403 || msg.includes('unauthorized') || msg.includes('forbidden')) return 'auth';
        if (status === 429 || msg.includes('rate limit') || msg.includes('throttl')) return 'rate_limit';
        if (status === 404 || msg.includes('not found') || msg.includes('does not exist')) return 'not_found';
        if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('etimedout')) return 'timeout';
        if (status && status >= 500) return 'service_error';
    }
    return 'unknown';
}

// --- Zod Error Formatting ---

/**
 * Format a ZodError into a human-readable message the LLM can act on.
 * Instead of raw Zod output, produces clear parameter-level guidance.
 */
export function formatZodError(error: ZodError): string {
    const issues = error.issues.map(formatZodIssue);
    return `Input validation failed:\n${issues.join('\n')}`;
}

function formatZodIssue(issue: ZodIssue): string {
    const path = issue.path.length > 0 ? `\`${issue.path.join('.')}\`` : 'root';
    switch (issue.code) {
        case 'invalid_type':
            return `- Parameter ${path}: expected \`${issue.expected}\` but got \`${issue.received}\``;
        case 'unrecognized_keys': {
            const keysIssue = issue as ZodIssue & { keys?: string[] };
            return `- Unexpected parameters: ${keysIssue.keys?.map((k) => `\`${k}\``).join(', ') ?? 'unknown'}`;
        }
        case 'invalid_enum_value': {
            const enumIssue = issue as ZodIssue & { options?: string[] };
            return `- Parameter ${path}: must be one of ${enumIssue.options?.map((o) => `\`${o}\``).join(', ') ?? 'unknown'}`;
        }
        case 'too_small':
            return `- Parameter ${path}: ${issue.message}`;
        case 'too_big':
            return `- Parameter ${path}: ${issue.message}`;
        default:
            return `- Parameter ${path}: ${issue.message}`;
    }
}

// --- Generic Error Formatting ---

/**
 * Format any tool error into a structured message suitable for LLM consumption.
 * Includes: category, message, recovery hint, and truncation for large errors.
 */
export function formatToolError(toolName: string, error: unknown): string {
    const category = classifyError(error);

    // Zod errors get special formatting
    if (error instanceof ZodError) {
        return formatZodError(error);
    }

    const message = error instanceof Error ? error.message : String(error);
    const truncated = truncateError(message);
    const hint = getRecoveryHint(category, toolName);

    const parts = [`Tool \`${toolName}\` failed (${category}): ${truncated}`];
    if (hint) parts.push(`Recovery hint: ${hint}`);
    return parts.join('\n');
}

function truncateError(message: string): string {
    if (message.length <= MAX_ERROR_LENGTH) return message;
    const head = message.slice(0, TRUNCATION_KEEP_CHARS);
    const tail = message.slice(-TRUNCATION_KEEP_CHARS);
    const omitted = message.length - (TRUNCATION_KEEP_CHARS * 2);
    return `${head}\n\n... [${omitted.toLocaleString()} chars truncated] ...\n\n${tail}`;
}

function getRecoveryHint(category: ErrorCategory, _toolName: string): string | null {
    switch (category) {
        case 'validation':
            return 'Check input parameter types and required fields.';
        case 'auth':
            return 'Credentials may be expired or insufficient. Try a different approach that does not require this tool.';
        case 'rate_limit':
            return 'Too many requests. This will be retried automatically. Focus on other tools meanwhile.';
        case 'not_found':
            return `The resource was not found. Verify the identifier is correct, or try a broader search.`;
        case 'timeout':
            return 'Operation timed out. Try with a smaller scope (shorter time range, fewer results, specific filter).';
        case 'service_error':
            return 'External service error. This may be transient. Focus on other investigation paths.';
        default:
            return null;
    }
}

// --- Hindsight-Enhanced Error Context ---

/**
 * Enrich a tool error with past resolution context from Hindsight.
 * If we've seen this error pattern before, include what worked last time.
 */
export async function enrichErrorWithMemory(
    toolName: string,
    error: unknown,
    agentMemory: AgentMemory | undefined,
    tenantId: string,
): Promise<string> {
    const baseError = formatToolError(toolName, error);
    if (!agentMemory) return baseError;

    const category = classifyError(error);
    const errorMsg = error instanceof Error ? error.message : String(error);

    try {
        const memories = await agentMemory.recall(
            tenantId,
            `Tool "${toolName}" error: ${category}. ${errorMsg.slice(0, 200)}`,
            { maxResults: 2, tags: ['tool_error', toolName], budget: 'low' },
        );

        if (memories.length > 0) {
            const pastContext = memories.map(m => m.text).join('\n');
            return `${baseError}\n\nPast resolution for similar error:\n${pastContext}`;
        }
    } catch {
        // Non-critical — return base error
    }

    return baseError;
}

/**
 * Retain a tool error pattern in Hindsight for future reference.
 * Called after an agent successfully recovers from or works around an error.
 */
export async function retainToolErrorPattern(
    toolName: string,
    error: unknown,
    resolution: string,
    agentMemory: AgentMemory,
    tenantId: string,
): Promise<void> {
    const category = classifyError(error);
    const errorMsg = error instanceof Error ? error.message : String(error);

    await agentMemory.retain(
        tenantId,
        `Tool "${toolName}" error (${category}): ${errorMsg.slice(0, 300)}\nResolution: ${resolution}`,
        {
            tags: ['tool_error', toolName, category],
            metadata: { toolName, errorCategory: category },
        },
    );
}

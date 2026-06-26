import { RelayGatewayError, type RelayQueryResult } from '../../../../shared/application/ports/relay-gateway.port.js';

/**
 * Stable envelope returned to the agent after every relay tool call.
 *
 * The agent receives JSON. A successful call carries `status: "ok"`
 * and the query payload. Structural failures — approval required,
 * session denied, rate limited — carry a specific status so the LLM
 * can reason about them rather than seeing a generic error string.
 */
export type RelayToolEnvelope =
    | {
        status: 'ok';
        rowCount: number;
        executionTimeMs: number;
        rows: unknown;
        masking?: { totalFields: number; detections: Array<{ detector: string; count: number }> } | null;
        warnings?: string[];
    }
    | { status: 'approval_pending'; reason: string; retriable: false; hint: string }
    | { status: 'session_denied'; reason: string; retriable: false; hint: string }
    | { status: 'rate_limited'; reason: string; retriable: true; hint: string }
    | { status: 'policy_denied'; reason: string; retriable: false; hint: string }
    | { status: 'validation_failed'; reason: string; retriable: false; hint: string }
    | { status: 'not_connected'; reason: string; retriable: true; hint: string }
    | { status: 'error'; reason: string; retriable: boolean };

export interface WrapOptions {
    maxRows?: number;
}

/**
 * Convert a relay gateway result into the stable envelope the agent sees.
 * Mask metadata (detections) is surfaced as a "sidecar" summary — never
 * as raw values — so the LLM knows what was redacted without seeing it.
 */
export function wrapRelaySuccess(result: RelayQueryResult, opts: WrapOptions = {}): RelayToolEnvelope {
    if (result.requiresApproval) {
        return {
            status: 'approval_pending',
            reason: 'The relay requires human approval for this query (size or sensitive table).',
            retriable: false,
            hint: 'Wait for the approval to be granted via the dashboard, then retry. Reduce limit or target a non-sensitive table to avoid the threshold.',
        };
    }

    const maxRows = opts.maxRows;
    const limitedRows = maxRows !== undefined && Array.isArray(result.rows) && result.rows.length > maxRows
        ? result.rows.slice(0, maxRows)
        : result.rows;

    return {
        status: 'ok',
        rowCount: result.rowCount,
        executionTimeMs: result.executionTimeMs,
        rows: limitedRows,
        masking: result.masked
            ? {
                totalFields: result.maskedFieldCount,
                detections: result.detections ?? [],
            }
            : null,
        warnings: result.warnings,
    };
}

export function wrapRelayError(err: unknown): RelayToolEnvelope {
    if (err instanceof RelayGatewayError) {
        switch (err.code) {
            case 'approval_required':
                return {
                    status: 'approval_pending',
                    reason: err.message,
                    retriable: false,
                    hint: 'Query exceeds a policy threshold. Request approval or shrink the query scope.',
                };
            case 'session_denied':
                return {
                    status: 'session_denied',
                    reason: err.message,
                    retriable: false,
                    hint: 'Break-glass is active or the incident is not in an active investigation window. Escalate to the operator.',
                };
            case 'rate_limited':
                return {
                    status: 'rate_limited',
                    reason: err.message,
                    retriable: true,
                    hint: 'Wait a few seconds before retrying this resource, or reduce query cadence.',
                };
            case 'policy_denied':
                return {
                    status: 'policy_denied',
                    reason: err.message,
                    retriable: false,
                    hint: 'The operation or target table is blocked by policy. Pick another resource or operation.',
                };
            case 'validation_failed':
                return {
                    status: 'validation_failed',
                    reason: err.message,
                    retriable: false,
                    hint: 'The input failed driver-side validation. Inspect the query syntax or filter operators.',
                };
            case 'not_connected':
                return {
                    status: 'not_connected',
                    reason: err.message,
                    retriable: true,
                    hint: 'The relay for this tenant is offline. List available resources again or wait and retry.',
                };
            case 'unknown_resource':
                return {
                    status: 'error',
                    reason: err.message,
                    retriable: false,
                };
            case 'relay_timeout':
                return {
                    status: 'error',
                    reason: err.message,
                    retriable: true,
                };
            default:
                return {
                    status: 'error',
                    reason: err.message,
                    retriable: false,
                };
        }
    }

    return {
        status: 'error',
        reason: err instanceof Error ? err.message : String(err),
        retriable: false,
    };
}

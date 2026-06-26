/**
 * cite_evidence — deterministic citation tool.
 *
 * The agent uses this to bind claims to a specific tool call output.
 * The handler refuses citations that:
 *   1. reference a toolCallId that never happened in this run, or
 *   2. include a `quote` that is not a literal substring of that call's output.
 *
 * On failure, it returns a structured error so the agent sees the reason
 * and can retry with a corrected quote. Successful citations are persisted
 * as Evidence records linked to the underlying ToolCall.
 */
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { logger } from '../../../shared/infra/logger.js';
import { evidenceId, toolCallId as toToolCallId } from '../../../shared/domain/value-objects.js';
import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { IEvidenceRepository } from '../../triage/domain/evidence.repository.js';
import type { ToolCallTracker } from '../../../shared/infra/llm/tool-call-tracker.js';
import type { IInvestigationChannel } from '../../../shared/application/ports/investigation-channel.port.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';

function zodToInputSchema(schema: z.ZodTypeAny) {
    const { $schema: _, ...rest } = zodToJsonSchema(schema);
    return rest;
}

export const CITE_EVIDENCE_TOOL: ToolDefinition = {
    name: 'cite_evidence',
    description:
        'Record a piece of evidence that supports a claim. ' +
        'Every finding in your final thesis must be backed by at least one cite_evidence call. ' +
        'The toolCallId comes from the [toolCallId=tc_xxx] header at the top of any tool output you received. ' +
        'The quote MUST be a literal substring copied exactly from that output (including numbers, identifiers, whitespace). ' +
        'If the citation is rejected, you will see the first 500 chars of the output — re-copy the quote from there.',
    inputSchema: zodToInputSchema(
        z.object({
            toolCallId: z.string().describe('The tc_xxx id shown in the header of the tool output you are citing.'),
            claim: z.string().describe('What this evidence proves, in your own words. Example: "API p95 latency degraded to 8.2s at 14:32".'),
            quote: z.string().describe('Literal substring from the tool output that supports the claim. Copy exactly — validator compares byte-for-byte.'),
        }),
    ),
    isConcurrencySafe: true,
};

interface CiteEvidenceDeps {
    tracker: ToolCallTracker;
    evidenceRepo: IEvidenceRepository;
    tenantId: TenantId;
    incidentId: IncidentId;
    channel?: IInvestigationChannel;
}

/**
 * Classify a tool name into an evidence type for display purposes.
 * Deterministic mapping — no LLM reasoning. Unknown tools fall back to resource_state.
 */
function evidenceTypeForTool(toolName: string, input: Record<string, unknown>): Evidence['evidenceType'] {
    if (toolName === 'memory_recall' || toolName === 'memory_reflect' || toolName === 'recall_past_incidents' || toolName === 'reflect_on_knowledge') {
        return 'historical_context';
    }
    if (toolName === 'aws_api_call') {
        const service = String(input['service'] ?? '').toLowerCase();
        if (service === 'logs' || service === 'cloudwatchlogs') return 'log_snippet';
        if (service === 'cloudwatch') return 'metric_snapshot';
        return 'resource_state';
    }
    return 'resource_state';
}

// Local re-declaration to avoid circular type import
type Evidence = import('../../triage/domain/evidence.repository.js').Evidence;

export function createCiteEvidenceHandler(deps: CiteEvidenceDeps) {
    return async (name: string, input: Record<string, unknown>): Promise<string | null> => {
        if (name !== 'cite_evidence') return null;

        const parseResult = z
            .object({
                toolCallId: z.string(),
                claim: z.string().min(5),
                quote: z.string().min(1),
            })
            .safeParse(input);

        if (!parseResult.success) {
            return JSON.stringify({
                ok: false,
                error: 'invalid_input',
                hint: parseResult.error.message,
            });
        }

        const { toolCallId, claim, quote } = parseResult.data;

        const toolCall = deps.tracker.lookup(toolCallId);
        if (!toolCall) {
            const known = deps.tracker.all().slice(-8).map((c) => `${c.id}(${c.name})`);
            return JSON.stringify({
                ok: false,
                error: 'unknown_tool_call_id',
                hint: `toolCallId '${toolCallId}' does not exist in this run. Recent ids: ${known.join(', ')}. Copy the id from the [toolCallId=...] header of the tool output you want to cite.`,
            });
        }

        if (!toolCall.output.includes(quote)) {
            const preview = toolCall.output.slice(0, 500);
            return JSON.stringify({
                ok: false,
                error: 'quote_not_found',
                hint: `The quote is not a literal substring of tool call ${toolCallId} (${toolCall.name}) output. Copy the quote byte-for-byte from the output. First 500 chars of the actual output: ${JSON.stringify(preview)}`,
            });
        }

        const evId = evidenceId(uuidv4());
        const evidenceType = evidenceTypeForTool(toolCall.name, toolCall.input);
        const content = `${claim}\n\nEvidence: ${JSON.stringify(quote)}`;

        try {
            await deps.evidenceRepo.create({
                tenantId: deps.tenantId,
                incidentId: deps.incidentId,
                evidenceId: evId,
                agentRole: 'orchestrator',
                evidenceType,
                content,
                toolCallId: toToolCallId(toolCallId),
                claim,
                quote,
                metadata: { toolName: toolCall.name, source: 'cite_evidence' },
                createdAt: new Date().toISOString(),
            });
        } catch (err) {
            logger.warn({ err, incidentId: deps.incidentId, toolCallId }, 'cite_evidence: evidence persistence failed');
            return JSON.stringify({
                ok: false,
                error: 'persistence_failed',
                hint: 'Try again; if it keeps failing, continue investigating without this citation.',
            });
        }

        if (deps.channel?.isConnected()) {
            deps.channel.sendEvidence({
                evidenceId: evId as string,
                agentRole: 'orchestrator',
                evidenceType,
                content,
                metadata: { toolName: toolCall.name, toolCallId, claim, quote },
            });
        }

        logger.info({ incidentId: deps.incidentId, evidenceId: evId, toolCallId, toolName: toolCall.name }, 'Evidence cited');

        return JSON.stringify({ ok: true, evidenceId: evId as string });
    };
}

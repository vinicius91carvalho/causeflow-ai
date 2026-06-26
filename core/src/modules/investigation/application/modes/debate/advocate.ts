import { ADVOCATE_SYSTEM_PROMPT } from './prompts.js';
import type { Hypothesis } from '../../../domain/hypothesis.entity.js';
import type { Incident } from '../../../../ingestion/domain/incident.entity.js';
import type {
    AgentRunner,
    AgentRunResult,
    ToolDefinition,
} from '../../../../../shared/application/ports/agent-runner.port.js';

export interface AdvocateDeps {
    agentRunner: AgentRunner;
    /** Sonnet-class model recommended — tool-use heavy. */
    model?: string;
}

export interface AdvocateInput {
    incident: Incident;
    hypothesis: Hypothesis;
    /** Fully assembled tool set (AWS + Composio + relay) from the toolset port. */
    tools: ToolDefinition[];
    /** Tool handler wired to the tenant's credentials + channel hooks. */
    toolHandler: (name: string, input: Record<string, unknown>) => Promise<string>;
    /** Capability section appended to the static system prompt. */
    capabilitiesPrompt: string;
    maxTurns?: number;
    minToolCalls?: number;
    onToolCall?: (toolName: string, input: Record<string, unknown>) => void;
    /**
     * Optional Mastra Memory config — when provided, the advocate's
     * conversation lives in its own isolated thread so the Langfuse audit
     * trail keeps each agent's reasoning separate. Usually populated by
     * DebateMode as `investigation-{incidentId}-advocate-{hypothesisId}`.
     */
    memory?: { thread: { id: string; metadata?: Record<string, unknown> }; resource: string };
}

export interface AdvocateResult {
    hypothesisId: string;
    run: AgentRunResult;
}

const DEFAULT_MAX_TURNS = 10;
const DEFAULT_MIN_TOOL_CALLS = 3;

/**
 * Advocate agent — argues FOR a single hypothesis. A separate Advocate
 * runs in parallel per hypothesis. Each instance is narrow-focused: it
 * only investigates the evidence path that could confirm its assigned
 * hypothesis, and honestly reports any contradictions it incidentally
 * discovers so the judge can weigh them.
 */
export class Advocate {
    constructor(private readonly deps: AdvocateDeps) {}

    async run(input: AdvocateInput): Promise<AdvocateResult> {
        const userPrompt = `Incident:
Title: ${input.incident.title}
Description: ${input.incident.description}
Severity: ${input.incident.severity}

## Hypothesis you are advocating for

id: ${input.hypothesis.hypothesisId}
Statement: ${input.hypothesis.statement}
Rationale: ${input.hypothesis.rationale ?? '—'}
Prior confidence: ${(input.hypothesis.confidence * 100).toFixed(0)}%

Investigate this hypothesis. Find supporting evidence. Report contradictions you discover. End with your summary + honest confidence.`;

        const run = await this.deps.agentRunner.run({
            model: this.deps.model,
            systemPrompt: ADVOCATE_SYSTEM_PROMPT + input.capabilitiesPrompt,
            userPrompt,
            tools: input.tools,
            toolHandler: input.toolHandler,
            maxTurns: input.maxTurns ?? DEFAULT_MAX_TURNS,
            minToolCalls: input.minToolCalls ?? DEFAULT_MIN_TOOL_CALLS,
            onToolCall: input.onToolCall,
            memory: input.memory,
        });

        return { hypothesisId: input.hypothesis.hypothesisId, run };
    }
}

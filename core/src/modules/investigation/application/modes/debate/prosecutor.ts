import { PROSECUTOR_SYSTEM_PROMPT } from './prompts.js';
import type { Hypothesis } from '../../../domain/hypothesis.entity.js';
import type { Incident } from '../../../../ingestion/domain/incident.entity.js';
import type {
    AgentRunner,
    AgentRunResult,
    ToolDefinition,
} from '../../../../../shared/application/ports/agent-runner.port.js';

export interface ProsecutorDeps {
    agentRunner: AgentRunner;
    /** Sonnet-class model recommended. */
    model?: string;
}

export interface ProsecutorInput {
    incident: Incident;
    hypothesis: Hypothesis;
    /** Advocate's final summary text — the case the prosecutor must rebut. */
    advocateSummary: string;
    tools: ToolDefinition[];
    toolHandler: (name: string, input: Record<string, unknown>) => Promise<string>;
    capabilitiesPrompt: string;
    maxTurns?: number;
    minToolCalls?: number;
    onToolCall?: (toolName: string, input: Record<string, unknown>) => void;
    /**
     * Isolated Mastra Memory thread for this prosecutor — keeps its
     * transcript separate from the paired advocate and the other
     * hypotheses. DebateMode populates as
     * `investigation-{incidentId}-prosecutor-{hypothesisId}`.
     */
    memory?: { thread: { id: string; metadata?: Record<string, unknown> }; resource: string };
}

export interface ProsecutorResult {
    hypothesisId: string;
    run: AgentRunResult;
}

const DEFAULT_MAX_TURNS = 7;
const DEFAULT_MIN_TOOL_CALLS = 2;

/**
 * Prosecutor agent — attacks a single hypothesis after its advocate has
 * gathered evidence. Sees both the hypothesis statement AND the advocate's
 * summary, then goes looking for contradictions, confounders, or missing
 * signals that would undermine the case.
 *
 * Run in parallel across hypotheses. Each prosecutor is independent — it
 * doesn't propose alternative hypotheses (those have their own advocates).
 */
export class Prosecutor {
    constructor(private readonly deps: ProsecutorDeps) {}

    async run(input: ProsecutorInput): Promise<ProsecutorResult> {
        const userPrompt = `Incident:
Title: ${input.incident.title}
Description: ${input.incident.description}
Severity: ${input.incident.severity}

## Hypothesis under prosecution

id: ${input.hypothesis.hypothesisId}
Statement: ${input.hypothesis.statement}

## Advocate's summary (the case to rebut)

${input.advocateSummary}

Try to refute this hypothesis. Find counter-evidence. Attack the advocate's reasoning where it's weakest. End with your summary + honest confidence that the hypothesis is WRONG.`;

        const run = await this.deps.agentRunner.run({
            model: this.deps.model,
            systemPrompt: PROSECUTOR_SYSTEM_PROMPT + input.capabilitiesPrompt,
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

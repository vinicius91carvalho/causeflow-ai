import type { Incident } from '../../../../ingestion/domain/incident.entity.js';
import type {
    AgentRunner,
    AgentRunResult,
    ToolDefinition,
} from '../../../../../shared/application/ports/agent-runner.port.js';

const RECON_SYSTEM_PROMPT = `You are doing fast reconnaissance BEFORE a root-cause investigation begins. A seeker agent will use your summary as context to generate hypotheses, and downstream agents will deepen the investigation with more tools.

## Your job

Call 3-5 targeted tools to establish what is most likely relevant, then summarize concisely. Prioritize in this order:

1. **Recent deploys / code changes** — if GitHub/GitLab is available, list PRs merged in the last 24-48h on the affected service. A deploy within the incident window is the single strongest prior.
2. **Error / alert signals** — if Sentry/CloudWatch/Datadog is available, query for the error rate spike: when did it start, which endpoint/service, what error message.
3. **Infrastructure state** — if AWS is available, check if the affected service is healthy (ECS/Lambda/RDS state), recent restarts, or scaling events.
4. **Past incidents** — if memory is available, recall similar incidents for the affected service.

## Rules

- **Budget is hard.** Do not exceed 5 tool calls. If you run out of budget before gathering enough signal, stop and summarize what you have.
- **Be terse.** Your output will be pasted into another prompt. No fluff, no apologies, no "I looked at...". Just observations.
- **Cite what you found.** Numbers, timestamps, identifiers. "PR #412 merged at 14:29 UTC" not "a recent PR was merged".
- **Cite what you couldn't find.** If GitHub wasn't available or returned empty, say so — the seeker needs to know what's absent.

## Output format (markdown)

Output ONLY these sections. Omit a section entirely if empty.

## Recent deploys
- (line per PR/commit with timestamp + title if found, or "no data available")

## Error signals
- (line per relevant signal with timestamp + endpoint + count)

## Infrastructure state
- (line per resource with current state)

## Past incidents
- (line per similar incident with date + outcome)`;

export interface ReconDeps {
    agentRunner: AgentRunner;
    model?: string;
}

export interface ReconInput {
    incident: Incident;
    tools: ToolDefinition[];
    toolHandler: (name: string, input: Record<string, unknown>) => Promise<string>;
    capabilitiesPrompt: string;
    maxTurns?: number;
    maxToolCalls?: number;
    onToolCall?: (toolName: string, input: Record<string, unknown>) => void;
}

export interface ReconResult {
    /** Markdown summary ready to be injected into the seeker's memoryContext. */
    summary: string;
    /** True when no useful signal was gathered. The caller should feed only the catalog + symptoms to the seeker. */
    empty: boolean;
    run: AgentRunResult;
}

const DEFAULT_MAX_TURNS = 6;
const DEFAULT_MAX_TOOL_CALLS = 5;

/**
 * Pre-seeker reconnaissance. Runs a tightly budgeted mini-agent that
 * gathers 3-5 targeted signals (recent deploys, error signals, infra
 * state, past incidents) so the seeker can generate hypotheses informed
 * by live data instead of symptoms alone.
 *
 * Intentionally stateless and narrow — NOT a full investigation. Budget
 * is capped so this never turns into a runaway "mini investigation"
 * that steals time from the real one.
 *
 * Degrades gracefully: if the tenant has zero integrations (empty tools
 * array), this class should not even be called — that decision lives in
 * the caller (HypothesisMode / DebateMode).
 */
export class Recon {
    constructor(private readonly deps: ReconDeps) {}

    async run(input: ReconInput): Promise<ReconResult> {
        const userPrompt = `Incident under investigation:
Title: ${input.incident.title}
Description: ${input.incident.description}
Severity: ${input.incident.severity}
Source: ${input.incident.sourceProvider}

Do reconnaissance. ${input.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS} tool calls max. Output the markdown summary.`;

        const run = await this.deps.agentRunner.run({
            model: this.deps.model,
            systemPrompt: RECON_SYSTEM_PROMPT + input.capabilitiesPrompt,
            userPrompt,
            tools: input.tools,
            toolHandler: input.toolHandler,
            maxTurns: input.maxTurns ?? DEFAULT_MAX_TURNS,
            onToolCall: input.onToolCall,
        });

        const trimmed = (run.response ?? '').trim();
        // Heuristic: if the agent responded with nothing substantive or
        // only placeholder markers, we consider recon empty and let the
        // caller fall back to catalog-only hypothesis generation.
        const empty = trimmed.length < 40 || /no data available/i.test(trimmed) && trimmed.length < 200;

        return { summary: trimmed, empty, run };
    }
}

import { judgeOutputSchema } from '../hypothesis/schemas.js';
import { DEBATE_JUDGE_SYSTEM_PROMPT } from './prompts.js';
import type { JudgeOutput } from '../hypothesis/schemas.js';
import type { Hypothesis } from '../../../domain/hypothesis.entity.js';
import type { Incident } from '../../../../ingestion/domain/incident.entity.js';
import type { LLMClient } from '../../../../../shared/application/ports/llm-client.port.js';
import type { AgentRunResult } from '../../../../../shared/application/ports/agent-runner.port.js';

export interface DebateJudgeDeps {
    llmClient: LLMClient;
    model?: string;
}

export interface DebateRound {
    hypothesis: Hypothesis;
    advocate: AgentRunResult;
    prosecutor: AgentRunResult;
}

export interface DebateJudgeInput {
    incident: Incident;
    rounds: DebateRound[];
}

export interface DebateJudgeResult {
    output: JudgeOutput;
    costUsd: number;
    usage: { inputTokens: number; outputTokens: number };
}

/**
 * Compact tool-call transcript. The judge needs to see WHAT the agent did,
 * not just what it said — but we cap per-call length so the prompt stays
 * within context budget across 6 transcripts (3 advocates + 3 prosecutors).
 */
function formatToolCalls(calls: AgentRunResult['toolCalls'], maxPerCall = 400): string {
    if (calls.length === 0) return '(no tool calls)';
    return calls
        .map((c, i) => {
            const inputStr = JSON.stringify(c.input).slice(0, 150);
            const outputStr = (c.output ?? '').slice(0, maxPerCall);
            return `### Call ${i + 1}: ${c.name}\nInput: ${inputStr}\nOutput: ${outputStr}`;
        })
        .join('\n\n');
}

function formatRound(round: DebateRound, index: number): string {
    return `## Hypothesis ${index + 1} (id=${round.hypothesis.hypothesisId})
Statement: ${round.hypothesis.statement}
Prior: ${(round.hypothesis.confidence * 100).toFixed(0)}%

### Advocate summary
${round.advocate.response}

### Advocate tool calls (${round.advocate.toolCalls.length})
${formatToolCalls(round.advocate.toolCalls)}

### Prosecutor summary
${round.prosecutor.response}

### Prosecutor tool calls (${round.prosecutor.toolCalls.length})
${formatToolCalls(round.prosecutor.toolCalls)}`;
}

/**
 * Final judge for multi-agent debate mode. Reads every (advocate, prosecutor)
 * pair and produces the canonical InvestigationResult plus per-hypothesis
 * rulings that the DebateMode persists back onto each Hypothesis entity.
 */
export class DebateJudge {
    constructor(private readonly deps: DebateJudgeDeps) {}

    async run(input: DebateJudgeInput): Promise<DebateJudgeResult> {
        const userPrompt = `Incident:
Title: ${input.incident.title}
Description: ${input.incident.description}
Severity: ${input.incident.severity}

You have ${input.rounds.length} hypotheses with paired advocate + prosecutor transcripts. Read them carefully. Score each hypothesis, then pick exactly ONE winner.

${input.rounds.map(formatRound).join('\n\n---\n\n')}

Hypothesis ids must match the provided ones verbatim. Cite specific evidence from the transcripts in your rulings.`;

        const completion = await this.deps.llmClient.complete({
            model: this.deps.model,
            systemPrompt: DEBATE_JUDGE_SYSTEM_PROMPT,
            userPrompt,
            maxTokens: 4096,
            temperature: 0,
            responseSchema: judgeOutputSchema,
        });

        return {
            output: completion.content as JudgeOutput,
            costUsd: completion.costUsd,
            usage: completion.usage,
        };
    }
}

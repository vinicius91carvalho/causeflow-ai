import { judgeOutputSchema } from './schemas.js';
import { JUDGE_SYSTEM_PROMPT } from './prompts.js';
import type { JudgeOutput } from './schemas.js';
import type { Hypothesis } from '../../../domain/hypothesis.entity.js';
import type { Incident } from '../../../../ingestion/domain/incident.entity.js';
import type { LLMClient } from '../../../../../shared/application/ports/llm-client.port.js';
import type { ToolCallRecord } from '../../../../../shared/application/ports/agent-runner.port.js';

export interface JudgeDeps {
    llmClient: LLMClient;
    model?: string;
}

export interface JudgeInput {
    incident: Incident;
    hypotheses: Hypothesis[];
    validatorSummary: string;
    validatorToolCalls: ToolCallRecord[];
}

export interface JudgeResult {
    output: JudgeOutput;
    costUsd: number;
    usage: { inputTokens: number; outputTokens: number };
}

/**
 * Compose a compact transcript from the validator's tool calls — truncated
 * per-call so the prompt stays under the judge's context budget. The judge
 * needs to see what the validator DID, not just what it said.
 */
function formatToolCalls(calls: ToolCallRecord[], maxPerCall = 800): string {
    if (calls.length === 0) return '(no tool calls)';
    return calls
        .map((c, i) => {
            const inputStr = JSON.stringify(c.input).slice(0, 200);
            const outputStr = (c.output ?? '').slice(0, maxPerCall);
            return `## Call ${i + 1}: ${c.name}\nInput: ${inputStr}\nOutput:\n${outputStr}`;
        })
        .join('\n\n');
}

function formatHypotheses(hypotheses: Hypothesis[]): string {
    return hypotheses
        .map((h, i) => `H${i + 1} (id=${h.hypothesisId}, prior=${h.confidence.toFixed(2)}):\n  Statement: ${h.statement}\n  Rationale: ${h.rationale ?? 'n/a'}`)
        .join('\n\n');
}

export class Judge {
    constructor(private readonly deps: JudgeDeps) {}

    async run(input: JudgeInput): Promise<JudgeResult> {
        const userPrompt = `Incident:
Title: ${input.incident.title}
Description: ${input.incident.description}
Severity: ${input.incident.severity}

## Hypotheses
${formatHypotheses(input.hypotheses)}

## Validator summary
${input.validatorSummary}

## Validator tool calls (${input.validatorToolCalls.length} total)
${formatToolCalls(input.validatorToolCalls)}

Rule exactly ONE hypothesis as 'confirmed' (the winner). Every other hypothesis must be 'rejected' with a one-sentence reason citing specific evidence. Hypothesis ids must match the provided ones verbatim.`;

        const completion = await this.deps.llmClient.complete({
            model: this.deps.model,
            systemPrompt: JUDGE_SYSTEM_PROMPT,
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

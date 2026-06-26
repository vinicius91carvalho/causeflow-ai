import { v4 as uuidv4 } from 'uuid';
import { createPendingHypothesis } from '../../../domain/hypothesis.entity.js';
import { seekerOutputSchema } from './seeker-schema.js';
import { renderPatternsCatalogForPrompt, SRE_PATTERNS_CATALOG } from './patterns-catalog.js';
import type { SrePattern } from './patterns-catalog.js';
import type { Hypothesis } from '../../../domain/hypothesis.entity.js';
import type { Incident } from '../../../../ingestion/domain/incident.entity.js';
import type { LLMClient } from '../../../../../shared/application/ports/llm-client.port.js';
import type { IHypothesisRepository } from '../../../domain/hypothesis.repository.js';

const RESEEK_SYSTEM_PROMPT = `You are a senior SRE being called back to generate NEW root-cause hypotheses after the initial candidates were all refuted by investigation evidence.

## Context

The incident was investigated under a prior hypothesis set. Every one of those hypotheses has now been rejected by the judge because the evidence contradicted them. You will see:
1. The incident details.
2. The rejected hypotheses and their rejection reasons.
3. The observations (tool outputs) the earlier investigation gathered.

## Your task

Generate exactly 2 NEW hypotheses that are:
- **Informed by the observations**, not by the rejected hypotheses. The data has already told you things. Use it.
- **Mutually distinct** from each other AND from the rejected set. Do not propose variations of theories that were already eliminated.
- **Specific and testable**, citing the observed data in the rationale whenever possible.

Each hypothesis must declare \`informedBy\` with concrete sources — typically \`observation:<what-you-saw>\` tags pointing to specific observations plus, when relevant, catalog pattern ids.

Return JSON matching the required schema. No prose outside the JSON.`;

const SEEKER_SYSTEM_PROMPT = `You are a senior SRE generating the initial hypothesis set for an incident investigation.

Your task: read the incident symptoms and produce 3 distinct, plausible root-cause hypotheses that will be tested in parallel.

## Requirements

1. Hypotheses must be **mutually distinct**. Do NOT produce three variations of the same theory.
2. Favor **specific, testable** statements over vague ones. "Query regression on users table after release 2.4.1" beats "database issue".
3. Cover different layers when possible: infra / runtime, application / code, data, dependency.
4. Each hypothesis gets a prior in [0, 1] — your honest best guess before evidence, not wishful thinking. Spread priors: do not give all three 0.9.
5. Order by priorConfidence descending.

## Sourcing — the \`informedBy\` field

Each hypothesis MUST declare what sourced it. Use tag strings:

- \`pattern:<id>\` — a catalog pattern from the list below informed it. Multiple patterns OK.
- \`memory:<descriptor>\` — a memory recall snippet informed it (only if memory context was provided in the user prompt).
- \`integration:<provider>:<descriptor>\` — an integration signal in the user prompt informed it (e.g. \`integration:github:PR-412-merged-at-14:29\`).
- \`llm:prior\` — generated purely from general SRE knowledge (use sparingly — prefer citing a catalog pattern when one applies).

A hypothesis without any sourcing is a guess. Don't produce guesses.

Return JSON matching the required schema. No prose outside the JSON.`;

export interface SeekerDeps {
    llmClient: LLMClient;
    hypothesisRepo: IHypothesisRepository;
    /** Sonnet-class model recommended — the seeker defines the ceiling of the investigation. */
    model?: string;
    /**
     * Optional catalog override. Default: the full SRE_PATTERNS_CATALOG.
     * Tests can inject a narrowed catalog to keep prompts short.
     */
    catalog?: readonly SrePattern[];
}

export interface SeekerResult {
    hypotheses: Hypothesis[];
    costUsd: number;
    usage: { inputTokens: number; outputTokens: number };
}

/**
 * Phase 1 of hypothesis-based modes. Runs a cheap model with no tools and
 * returns 3 mutually distinct candidate root-cause hypotheses persisted
 * as Hypothesis entities.
 *
 * Prompting strategy:
 *   - Injects the SRE patterns catalog as universal priors so even tenants
 *     with no memory or integrations get informed hypotheses.
 *   - Requires every hypothesis to cite sourcing via `informedBy` tags so
 *     the validator and UI can trace reasoning back to its origin.
 */
export class Seeker {
    constructor(private readonly deps: SeekerDeps) {}

    async run(incident: Incident, memoryContext?: string): Promise<SeekerResult> {
        const catalog = this.deps.catalog ?? SRE_PATTERNS_CATALOG;
        const catalogSection = renderPatternsCatalogForPrompt(catalog);

        const userPrompt = `Incident under investigation:
Title: ${incident.title}
Description: ${incident.description}
Severity: ${incident.severity}
Source: ${incident.sourceProvider}${memoryContext ? `

Memory context from past incidents:
${memoryContext}` : ''}

${catalogSection}

Generate 3 distinct hypotheses about the likely root cause. Cite sourcing via \`informedBy\`. Follow the schema exactly.`;

        const completion = await this.deps.llmClient.complete({
            model: this.deps.model,
            systemPrompt: SEEKER_SYSTEM_PROMPT,
            userPrompt,
            maxTokens: 2000,
            temperature: 0.4, // a bit of diversity across hypotheses
            responseSchema: seekerOutputSchema,
        });

        const parsed = completion.content as {
            hypotheses: {
                statement: string;
                rationale: string;
                priorConfidence: number;
                informedBy: string[];
            }[];
        };

        const persisted: Hypothesis[] = [];
        for (const h of parsed.hypotheses) {
            const hypothesis = createPendingHypothesis({
                hypothesisId: uuidv4(),
                tenantId: incident.tenantId,
                incidentId: incident.incidentId,
                statement: h.statement,
                rationale: h.rationale,
                informedBy: h.informedBy,
                confidence: h.priorConfidence,
            });
            persisted.push(await this.deps.hypothesisRepo.create(hypothesis));
        }

        return {
            hypotheses: persisted,
            costUsd: completion.costUsd,
            usage: completion.usage,
        };
    }

    /**
     * Re-seek: generate 2 NEW hypotheses informed by observations after the
     * initial hypothesis set was exhausted (all rejected). Used as a
     * fallback by HypothesisMode / DebateMode when the judge returns every
     * ruling below the confidence threshold.
     */
    async reseek(params: {
        incident: Incident;
        rejectedHypotheses: { statement: string; rejectedReason?: string }[];
        observations: string;
    }): Promise<SeekerResult> {
        const rejectedBlock = params.rejectedHypotheses
            .map((h, i) => `${i + 1}. ${h.statement}${h.rejectedReason ? ` — rejected because: ${h.rejectedReason}` : ''}`)
            .join('\n');

        const userPrompt = `Incident under investigation:
Title: ${params.incident.title}
Description: ${params.incident.description}
Severity: ${params.incident.severity}

## Rejected hypotheses (do NOT repeat these)

${rejectedBlock}

## Observations gathered by the prior investigation

${params.observations}

Generate 2 NEW hypotheses that explain the observations. Cite which observations informed each one via \`informedBy\` tags. Follow the schema exactly.`;

        const completion = await this.deps.llmClient.complete({
            model: this.deps.model,
            systemPrompt: RESEEK_SYSTEM_PROMPT,
            userPrompt,
            maxTokens: 2000,
            temperature: 0.5,
            responseSchema: seekerOutputSchema,
        });

        const parsed = completion.content as {
            hypotheses: {
                statement: string;
                rationale: string;
                priorConfidence: number;
                informedBy: string[];
            }[];
        };

        const persisted: Hypothesis[] = [];
        for (const h of parsed.hypotheses) {
            const hypothesis = createPendingHypothesis({
                hypothesisId: uuidv4(),
                tenantId: params.incident.tenantId,
                incidentId: params.incident.incidentId,
                statement: h.statement,
                rationale: h.rationale,
                informedBy: h.informedBy,
                confidence: h.priorConfidence,
            });
            persisted.push(await this.deps.hypothesisRepo.create(hypothesis));
        }

        return {
            hypotheses: persisted,
            costUsd: completion.costUsd,
            usage: completion.usage,
        };
    }
}

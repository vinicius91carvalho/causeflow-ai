import { z } from 'zod';

/**
 * Output shape for the seeker phase (shared by hypothesis-driven and
 * multi-agent debate modes). The seeker generates 3 candidate root-cause
 * hypotheses up-front with a prior in [0, 1]. Validator/judge revise those
 * priors as evidence arrives.
 *
 * `informedBy` creates a traceability layer: every hypothesis declares what
 * sourced it — a catalog pattern id (`pattern:connection-pool-exhaustion`),
 * a memory recall (`memory:similar-incident-id`), an integration signal
 * (`integration:github:PR-412`), or pure LLM reasoning (`llm:prior`). This
 * lets the validator focus tool calls on confirming/refuting the stated
 * source, and lets the UI explain to the operator WHY each hypothesis was
 * proposed.
 */
export const seekerOutputSchema = z.object({
    hypotheses: z.array(z.object({
        statement: z.string().min(10),
        rationale: z.string().min(10),
        priorConfidence: z.number().min(0).max(1),
        informedBy: z.array(z.string().min(3)).min(1),
    })).min(2).max(4),
});

export type SeekerOutput = z.infer<typeof seekerOutputSchema>;

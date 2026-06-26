import { z } from 'zod';

// Seeker schema moved to modes/shared/seeker-schema.ts — re-exported here
// for backwards-compatible imports from within the hypothesis module.
export { seekerOutputSchema, type SeekerOutput } from '../shared/seeker-schema.js';

/**
 * JUDGE output — the final ruling over all hypotheses. The winner's
 * statement becomes the Incident's rootCause. Every hypothesis gets a
 * 0-100 score and either `confirmed` (the winner) or `rejected` with a
 * reason so the UI can show the audit trail.
 */
export const judgeOutputSchema = z.object({
    winnerHypothesisId: z.string(),
    potentialRootCause: z.string().min(10),
    findings: z.array(z.string()).min(1),
    recommendedActions: z.array(z.object({
        action: z.string(),
        label: z.string(),
        description: z.string(),
        rationale: z.string(),
        riskLevel: z.enum(['low', 'medium', 'high']),
        estimatedDuration: z.string(),
        automated: z.boolean().default(false),
        params: z.record(z.unknown()).default({}),
    })).default([]),
    evidence: z.array(z.object({ type: z.string(), content: z.string() })).default([]),
    customerExplanation: z.object({
        summary: z.string(),
        impact: z.string(),
        resolution: z.string(),
        eta: z.string().optional(),
    }).optional(),
    rulings: z.array(z.object({
        hypothesisId: z.string(),
        finalScore: z.number().min(0).max(100),
        status: z.enum(['confirmed', 'rejected']),
        rejectedReason: z.string().optional(),
        confidence: z.number().min(0).max(1),
        evidenceFor: z.array(z.object({
            summary: z.string(),
            weight: z.number().min(-1).max(1),
            toolName: z.string().optional(),
        })).default([]),
        evidenceAgainst: z.array(z.object({
            summary: z.string(),
            weight: z.number().min(-1).max(1),
            toolName: z.string().optional(),
        })).default([]),
    })).min(1),
});

export type JudgeOutput = z.infer<typeof judgeOutputSchema>;

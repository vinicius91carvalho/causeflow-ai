/**
 * Protocol for investigation WebSocket relay.
 *
 * Agent → User: checkpoint, progress, tool_call, question, complete, error
 * User → Agent: guidance, answer, abort
 */
import { z } from 'zod';

// --- Agent → User messages ---

export const checkpointMessageSchema = z.object({
    type: z.literal('checkpoint'),
    incidentId: z.string(),
    stage: z.string(),
    finding: z.string(),
    confidence: z.number().optional(),
    toolCallCount: z.number().optional(),
    turn: z.number().optional(),
    severity: z.enum(['info', 'warning', 'critical']).optional(),
    category: z.string().optional(),
    timestamp: z.string(),
});

export const progressMessageSchema = z.object({
    type: z.literal('progress'),
    incidentId: z.string(),
    stage: z.string(),
    message: z.string(),
    turn: z.number().optional(),
    maxTurns: z.number().optional(),
    timestamp: z.string(),
});

export const toolCallMessageSchema = z.object({
    type: z.literal('tool_call'),
    incidentId: z.string(),
    toolName: z.string(),
    input: z.record(z.unknown()).optional(),
    timestamp: z.string(),
});

export const questionMessageSchema = z.object({
    type: z.literal('question'),
    incidentId: z.string(),
    questionId: z.string(),
    question: z.string(),
    options: z.array(z.string()).optional(),
    timeoutMs: z.number().optional(),
    timestamp: z.string(),
});

export const completeMessageSchema = z.object({
    type: z.literal('complete'),
    incidentId: z.string(),
    rootCause: z.string().optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    recommendedActions: z.array(z.object({
        action: z.string(),
        label: z.string().optional(),
        description: z.string().optional(),
        riskLevel: z.string().optional(),
    })).optional(),
    status: z.string().optional(),
    costUsd: z.number().optional(),
    durationMs: z.number().optional(),
    agentsUsed: z.array(z.string()).optional(),
    timestamp: z.string(),
});

export const errorMessageSchema = z.object({
    type: z.literal('error'),
    incidentId: z.string(),
    message: z.string(),
    timestamp: z.string(),
});

export const idleMessageSchema = z.object({
    type: z.literal('idle'),
    incidentId: z.string(),
    summary: z.string(),
    context: z.object({
        title: z.string().optional(),
        description: z.string().optional(),
        rootCause: z.string().optional(),
        status: z.string().optional(),
        severity: z.string().optional(),
    }).optional(),
    expiresAt: z.string(),
    timestamp: z.string(),
});

export const followupMessageSchema = z.object({
    type: z.literal('followup'),
    incidentId: z.string(),
    message: z.string(),
    timestamp: z.string(),
});

export const evidenceMessageSchema = z.object({
    type: z.literal('evidence'),
    incidentId: z.string(),
    evidenceId: z.string(),
    agentRole: z.string(),
    evidenceType: z.string(),
    content: z.string(),
    metadata: z.record(z.unknown()).optional(),
    timestamp: z.string(),
});

/**
 * Server-generated status signal about the backing worker.
 * - `no_worker`: no worker is currently connected; dashboard should buffer guidance
 * - `provisioning`: server has dispatched a followup Fargate worker; expect ~45s
 * - `ready`: worker is connected and accepting guidance
 * - `disconnected`: worker dropped off (idle timeout or crash)
 */
export const workerStatusMessageSchema = z.object({
    type: z.literal('worker_status'),
    incidentId: z.string(),
    status: z.enum(['no_worker', 'provisioning', 'ready', 'disconnected']),
    timestamp: z.string(),
});

// --- User → Agent messages ---

export const guidanceMessageSchema = z.object({
    type: z.literal('guidance'),
    incidentId: z.string(),
    message: z.string(),
});

export const answerMessageSchema = z.object({
    type: z.literal('answer'),
    incidentId: z.string(),
    questionId: z.string(),
    answer: z.string(),
});

export const abortMessageSchema = z.object({
    type: z.literal('abort'),
    incidentId: z.string(),
});

export const heartbeatMessageSchema = z.object({
    type: z.literal('heartbeat'),
});

// --- Server → Worker (control) ---

/**
 * Signal the worker to shut down gracefully. The server sends this when the
 * last dashboard observer disconnects, so we stop paying for Fargate idle
 * time for sessions no one is watching.
 */
export const shutdownMessageSchema = z.object({
    type: z.literal('shutdown'),
    reason: z.enum(['no_observers', 'server_shutdown']).optional(),
});

// --- Union types ---

export type AgentToUserMessage = z.infer<typeof checkpointMessageSchema>
    | z.infer<typeof progressMessageSchema>
    | z.infer<typeof toolCallMessageSchema>
    | z.infer<typeof questionMessageSchema>
    | z.infer<typeof completeMessageSchema>
    | z.infer<typeof errorMessageSchema>
    | z.infer<typeof idleMessageSchema>
    | z.infer<typeof followupMessageSchema>
    | z.infer<typeof evidenceMessageSchema>
    | z.infer<typeof workerStatusMessageSchema>;

export type UserToAgentMessage = z.infer<typeof guidanceMessageSchema>
    | z.infer<typeof answerMessageSchema>
    | z.infer<typeof abortMessageSchema>;

export const userToAgentMessageSchema = z.union([
    guidanceMessageSchema,
    answerMessageSchema,
    abortMessageSchema,
    heartbeatMessageSchema,
]);

export function parseUserMessage(data: string): z.infer<typeof userToAgentMessageSchema> {
    return userToAgentMessageSchema.parse(JSON.parse(data));
}

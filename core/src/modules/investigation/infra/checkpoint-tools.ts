/**
 * Checkpoint tools for human-in-the-loop investigation.
 *
 * These tools allow the investigation agent to:
 * - report_finding: Notify the user of a key finding (non-blocking)
 * - request_confirmation: Pause and ask the user before proceeding (blocking with timeout)
 * - request_context: Ask the user for additional context (blocking with timeout)
 *
 * When no WebSocket channel is connected, blocking tools auto-resolve
 * with a default action so the investigation is never stuck.
 */
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { logger } from '../../../shared/infra/logger.js';
import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { IInvestigationChannel } from '../../../shared/application/ports/investigation-channel.port.js';

function zodToInputSchema(schema: z.ZodTypeAny) {
    const { $schema: _, ...rest } = zodToJsonSchema(schema);
    return rest;
}

const DEFAULT_TIMEOUT_MS = 5 * 60_000; // 5 minutes — ALB idle timeout is 300s, heartbeats keep connection alive

// --- Tool Definitions ---

export const reportFindingTool: ToolDefinition = {
    name: 'report_finding',
    description: 'Report a key finding to the operator in real-time. Use this when you discover something important (DLQ messages, suspicious deploy, service down, error pattern). This does NOT pause the investigation — it just notifies the operator. Use it liberally.',
    inputSchema: zodToInputSchema(z.object({
        finding: z.string().describe('What you found — be specific with numbers, timestamps, service names'),
        severity: z.enum(['info', 'warning', 'critical']).describe('How severe is this finding'),
        category: z.enum(['error_pattern', 'infrastructure', 'deployment', 'performance', 'configuration', 'security']).describe('Category of the finding'),
    })),
    isConcurrencySafe: true,
};

export const requestConfirmationTool: ToolDefinition = {
    name: 'request_confirmation',
    description: 'Ask the operator for confirmation before taking a significant action. Use this when you reach a decision point where the operator\'s input would change your approach. The operator has 5 minutes to respond — if they don\'t, you proceed with your default plan. Examples: "I found 64 DLQ messages. Should I read them?" or "I see a suspicious deploy from April 2. Should I investigate the diff?"',
    inputSchema: zodToInputSchema(z.object({
        question: z.string().describe('What you want to ask the operator — be clear and concise'),
        defaultAction: z.string().describe('What you will do if the operator does not respond within 60 seconds'),
        options: z.array(z.string()).optional().describe('Optional list of suggested answers'),
    })),
    isConcurrencySafe: false,
};

export const requestContextTool: ToolDefinition = {
    name: 'request_context',
    description: 'Ask the operator for additional context that you cannot find via tools. Use this when you need information about the system that isn\'t in AWS, logs, or code. Examples: "Which team owns the payment-webhook service?" or "Was there a manual config change recently?" The operator has 5 minutes to respond.',
    inputSchema: zodToInputSchema(z.object({
        question: z.string().describe('What context you need from the operator'),
        reason: z.string().describe('Why you need this information — what will it help you determine'),
    })),
    isConcurrencySafe: false,
};

export const CHECKPOINT_TOOLS: ToolDefinition[] = [
    reportFindingTool,
    requestConfirmationTool,
    requestContextTool,
];

// --- Tool Handler ---

/**
 * Pending question waiting for user answer via WebSocket.
 */
interface PendingQuestion {
    resolve: (answer: string) => void;
    timeout: ReturnType<typeof setTimeout>;
}

/**
 * Create a handler for checkpoint tools.
 * The channel is optional — if not connected, blocking tools auto-resolve.
 */
export function createCheckpointToolHandler(
    channel: IInvestigationChannel | undefined,
    incidentId: string,
): {
    handler: (name: string, input: Record<string, unknown>) => Promise<string | null>;
    cleanup: () => void;
} {
    const pendingQuestions = new Map<string, PendingQuestion>();

    // Listen for answers from the user via WebSocket
    if (channel) {
        channel.onGuidance((guidance: string) => {
            // Try to parse as an answer to a pending question
            try {
                const msg = JSON.parse(guidance);
                if (msg.questionId && pendingQuestions.has(msg.questionId)) {
                    const pending = pendingQuestions.get(msg.questionId)!;
                    clearTimeout(pending.timeout);
                    pending.resolve(msg.answer ?? guidance);
                    pendingQuestions.delete(msg.questionId);
                    return;
                }
            } catch { /* not JSON, treat as raw guidance */ }

            // If no specific question ID, resolve the oldest pending question
            if (pendingQuestions.size > 0) {
                const [questionId, pending] = pendingQuestions.entries().next().value as [string, PendingQuestion];
                clearTimeout(pending.timeout);
                pending.resolve(guidance);
                pendingQuestions.delete(questionId);
            }
        });
    }

    const handler = async (name: string, input: Record<string, unknown>): Promise<string | null> => {
        if (name === 'report_finding') {
            const finding = input['finding'] as string;
            const severity = input['severity'] as string;
            const category = input['category'] as string;

            logger.info({ incidentId, finding: finding.slice(0, 100), severity, category }, 'Agent reported finding');

            if (channel?.isConnected()) {
                channel.sendCheckpoint({
                    stage: 'finding',
                    finding,
                    severity: severity as 'info' | 'warning' | 'critical',
                    category,
                });
            }

            return `Finding reported to operator: "${finding}" [${severity}/${category}]. Continue investigating.`;
        }

        if (name === 'request_confirmation') {
            const question = input['question'] as string;
            const defaultAction = input['defaultAction'] as string;
            const options = input['options'] as string[] | undefined;

            logger.info({ incidentId, question: question.slice(0, 100), defaultAction }, 'Agent requesting confirmation');

            if (!channel?.isConnected()) {
                logger.info({ incidentId }, 'No operator connected — auto-proceeding with default action');
                return `No operator connected. Proceeding with default action: ${defaultAction}`;
            }

            // Send structured question via WebSocket and wait for answer
            const questionId = `q-${Date.now()}`;
            const answer = await new Promise<string>((resolve) => {
                const timeout = setTimeout(() => {
                    pendingQuestions.delete(questionId);
                    resolve(`[TIMEOUT] Operator did not respond within 5 minutes. Proceeding with: ${defaultAction}`);
                }, DEFAULT_TIMEOUT_MS);

                pendingQuestions.set(questionId, { resolve, timeout });

                channel.sendQuestion({
                    questionId,
                    question: `${question}\n(Default in 5 min: ${defaultAction})`,
                    options: options ?? [defaultAction],
                    timeoutMs: DEFAULT_TIMEOUT_MS,
                });
            });

            logger.info({ incidentId, questionId, answer: answer.slice(0, 100) }, 'Confirmation response received');
            return `Operator response: ${answer}`;
        }

        if (name === 'request_context') {
            const question = input['question'] as string;
            const reason = input['reason'] as string;

            logger.info({ incidentId, question: question.slice(0, 100), reason }, 'Agent requesting context');

            if (!channel?.isConnected()) {
                return `No operator connected. Could not get context for: "${question}". Reason needed: ${reason}. Continue with available data.`;
            }

            const questionId = `ctx-${Date.now()}`;
            const answer = await new Promise<string>((resolve) => {
                const timeout = setTimeout(() => {
                    pendingQuestions.delete(questionId);
                    resolve(`[TIMEOUT] Operator did not respond. Continue without this context.`);
                }, DEFAULT_TIMEOUT_MS);

                pendingQuestions.set(questionId, { resolve, timeout });

                channel.sendQuestion({
                    questionId,
                    question: `${question}\nReason: ${reason}`,
                    timeoutMs: DEFAULT_TIMEOUT_MS,
                });
            });

            logger.info({ incidentId, questionId, answer: answer.slice(0, 100) }, 'Context response received');
            return `Operator provided context: ${answer}`;
        }

        return null; // Not our tool
    };

    const cleanup = () => {
        for (const [, pending] of pendingQuestions) {
            clearTimeout(pending.timeout);
        }
        pendingQuestions.clear();
    };

    return { handler, cleanup };
}

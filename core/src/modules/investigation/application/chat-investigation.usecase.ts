import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../shared/infra/logger.js';
import { config } from '../../../shared/config/index.js';
import type { AgentRunner } from '../../../shared/application/ports/agent-runner.port.js';
import type { AgentMemory } from '../../../shared/application/ports/agent-memory.port.js';
import type { LLMClient } from '../../../shared/application/ports/llm-client.port.js';
import type { ChatPlatform } from '../../../shared/application/ports/chat-platform.port.js';
import type { TokenEncryption, EncryptedPayload } from '../../../shared/application/ports/token-encryption.port.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { IEvidenceRepository } from '../../triage/domain/evidence.repository.js';
import type { IChatHistoryRepository } from '../../memory/domain/chat-message.entity.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { SlackNotificationRepository } from '../../integration/infra/slack-notification.repository.js';
import type { AddInvestigationContextUseCase } from './add-investigation-context.usecase.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';

export interface ChatInvestigationInput {
    tenantId: TenantId;
    incidentId: IncidentId;
    message: string;
    actor?: string;
}

export interface ChatInvestigationOutput {
    response: string;
    chatId: string;
    action?: 'reinvestigation_triggered' | 'correction_recorded' | 'question_answered';
}

export interface ChatInvestigationDeps {
    incidentRepo: IIncidentRepository;
    evidenceRepo: IEvidenceRepository;
    agentRunner: AgentRunner;
    llmClient: LLMClient;
    agentMemory?: AgentMemory;
    chatHistory?: IChatHistoryRepository;
    chatPlatform?: ChatPlatform;
    tenantRepo?: ITenantRepository;
    tokenEncryption?: TokenEncryption;
    slackNotificationRepo?: SlackNotificationRepository;
    addInvestigationContext?: AddInvestigationContextUseCase;
    /** Dispatch a followup worker when no live worker is available */
    dispatchFollowupWorker?: (incidentId: string, tenantId: string) => Promise<void>;
}

type ChatIntent = 'question' | 'correction' | 'context';

const CLASSIFIER_PROMPT = `Classify this message about a completed incident investigation into exactly one intent. Return ONLY valid JSON:
{"intent": "question" | "correction" | "context", "reasoning": "one sentence"}

Intents:
- "correction": The operator is saying the investigation looked at the WRONG thing, focused on the wrong service/component, has the wrong root cause, or needs to investigate something different. This includes:
  - Redirecting the investigation to a different service/component ("o problema é no ECS, não na Lambda")
  - Saying the analysis is wrong or misguided ("está focada na coisa errada", "não é isso")
  - Asking to reinvestigate with different focus ("pode olhar o serviço X em vez de Y?")
  - Providing the real root cause ("the real problem is...", "na verdade era...")
  - Any message that implies the investigation conclusion needs to change
  When in doubt between "correction" and "context", prefer "correction" — it's safer to reinvestigate than to ignore feedback.
- "context": ONLY when the operator is adding supplementary information WITHOUT challenging the investigation direction. Pure facts like "we deployed at 2pm" or "this service handles webhooks". The operator is NOT asking for a new investigation.
- "question": Asking about the investigation results, clarifying findings, or general questions. The operator wants to understand, not change the investigation.`;

const FOLLOWUP_SYSTEM_PROMPT = `You are a senior SRE who completed an investigation. The operator is asking follow-up questions.

## Rules
- Be concise and direct — the operator already has the full investigation report
- Reference specific evidence from the investigation (timestamps, error counts, service names)
- If you don't have enough information to answer, say so honestly
- Do NOT make up data or fabricate evidence
- If the question is about something outside the investigation scope, suggest what the operator could check`;

export class ChatInvestigationUseCase {
    private deps: ChatInvestigationDeps;

    constructor(deps: ChatInvestigationDeps) {
        this.deps = deps;
    }

    async execute(input: ChatInvestigationInput): Promise<ChatInvestigationOutput> {
        const { tenantId, incidentId, message } = input;
        const chatId = `investigation-${incidentId}`;
        const now = new Date().toISOString();

        // 1. Load incident
        const incident = await this.deps.incidentRepo.findById(tenantId, incidentId);
        if (!incident) {
            return { response: 'Investigation not found.', chatId };
        }

        // 2. Save user message
        if (this.deps.chatHistory) {
            await this.deps.chatHistory.saveMessage({
                tenantId, chatId,
                messageId: `msg-${uuidv4().slice(0, 8)}`,
                role: 'user', content: message, createdAt: now,
            });
        }
        await this.mirrorToChatPlatform(tenantId, incident, `*Operator:* ${message}`, incident.slackNotificationTs);

        // 3. Classify intent
        const intent = await this.classifyIntent(message);
        logger.info({ tenantId, incidentId, intent, chatId }, 'Chat intent classified');

        // 4. Handle based on intent
        if (intent === 'correction' || intent === 'context') {
            return this.handleCorrectionOrContext(input, incident, intent, chatId);
        }

        // Default: question → Q&A
        return this.handleQuestion(input, incident, chatId);
    }

    private async classifyIntent(message: string): Promise<ChatIntent> {
        try {
            const result = await this.deps.llmClient.complete({
                model: 'claude-haiku-4-5',
                systemPrompt: CLASSIFIER_PROMPT,
                userPrompt: message,
                maxTokens: 100,
                temperature: 0,
            });
            const jsonStr = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
            const match = jsonStr.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]) as { intent?: string };
                if (['question', 'correction', 'context'].includes(parsed.intent ?? '')) {
                    return parsed.intent as ChatIntent;
                }
            }
        } catch { /* fallback */ }
        return 'question';
    }

    private async handleCorrectionOrContext(
        input: ChatInvestigationInput,
        incident: { title: string; description: string; rootCause?: string; status: string; slackNotificationTs?: string },
        intent: 'correction' | 'context',
        chatId: string,
    ): Promise<ChatInvestigationOutput> {
        const { tenantId, incidentId, message, actor } = input;
        const isCorrection = intent === 'correction';

        // 1. Retain in Hindsight for future learning
        if (this.deps.agentMemory) {
            const tag = isCorrection ? 'correction' : 'additional_context';
            await this.deps.agentMemory.retain(tenantId,
                `[${tag.toUpperCase()}] Operator feedback on incident "${incident.title}": ${message}` +
                (isCorrection && incident.rootCause ? ` (Original root cause was: "${incident.rootCause}")` : ''),
                {
                    tags: ['feedback', tag, `incident:${incidentId}`],
                    context: `chat-feedback:${incidentId}`,
                },
            ).catch(() => { /* non-critical */ });
        }

        // 2. Add context + reinvestigate (only if not already running)
        const alreadyRunning = incident.status === 'investigating';
        let reinvestigationTriggered = false;
        if (this.deps.addInvestigationContext) {
            try {
                const result = await this.deps.addInvestigationContext.execute({
                    tenantId,
                    incidentId,
                    context: message,
                    intent: isCorrection ? 'correction' : 'additional_context',
                    addedBy: actor ?? 'chat',
                    reinvestigate: isCorrection && !alreadyRunning,
                });
                reinvestigationTriggered = result.reinvestigationTriggered;
            } catch (err) {
                logger.warn({ err, tenantId, incidentId }, 'Failed to add investigation context');
            }
        }

        // 3. Build response
        let response: string;
        if (isCorrection && reinvestigationTriggered) {
            response = `Got it — I've recorded your correction and started a new investigation with this context. ` +
                `The new investigation will take into account that "${message.slice(0, 500)}". ` +
                `You'll see updates in the live feed shortly.`;
        } else if (isCorrection && alreadyRunning) {
            response = `I've recorded your correction. There's already an investigation running — ` +
                `the context has been added and will be available to the current investigation. ` +
                `No need to start a new one.`;
        } else if (isCorrection) {
            response = `I've recorded your correction for future investigations. ` +
                `The incident status (${incident.status}) doesn't allow automatic reinvestigation right now. ` +
                `You can manually trigger a new investigation if needed.`;
        } else {
            response = `Thanks for the additional context. I've saved it as evidence on this incident. ` +
                `This information will be available to future investigations of similar incidents.`;
        }

        // 4. Save response
        const slackThreadId = await this.mirrorToChatPlatform(
            tenantId,
            incident,
            response,
            incident.slackNotificationTs,
        );
        if (this.deps.chatHistory) {
            await this.deps.chatHistory.saveMessage({
                tenantId, chatId,
                messageId: `msg-${uuidv4().slice(0, 8)}`,
                role: 'assistant', content: response,
                slackThreadId,
                createdAt: new Date().toISOString(),
            });
        }

        logger.info({ tenantId, incidentId, intent, reinvestigationTriggered }, 'Chat correction/context handled');

        return {
            response,
            chatId,
            action: reinvestigationTriggered ? 'reinvestigation_triggered' : 'correction_recorded',
        };
    }

    private async handleQuestion(
        input: ChatInvestigationInput,
        incident: { title: string; description: string; rootCause?: string; status: string; slackNotificationTs?: string },
        chatId: string,
    ): Promise<ChatInvestigationOutput> {
        const { tenantId, incidentId, message } = input;

        // Load evidence
        const evidence = await this.deps.evidenceRepo.findByIncident(tenantId, incidentId);
        const evidenceSummary = evidence.slice(0, 5).map((e) =>
            `[${e.agentRole ?? 'agent'}] ${e.content?.slice(0, 300) ?? ''}`
        ).join('\n');

        // Load conversation history
        let historyContext = '';
        if (this.deps.chatHistory) {
            const history = await this.deps.chatHistory.getChat(tenantId, chatId);
            if (history.length > 0) {
                historyContext = '\n\n## Conversation History\n' +
                    history.slice(-10).map((m) => `${m.role === 'user' ? 'Operator' : 'Agent'}: ${m.content.slice(0, 300)}`).join('\n');
            }
        }

        // Recall from Hindsight
        let memoryContext = '';
        if (this.deps.agentMemory) {
            try {
                const memories = await this.deps.agentMemory.recall(tenantId, `${incident.title} ${message}`, {
                    maxResults: 3, budget: 'low',
                });
                if (memories.length > 0) {
                    memoryContext = '\n\n## Related Knowledge\n' + memories.map((m) => `- ${m.text}`).join('\n');
                }
            } catch { /* non-critical */ }
        }

        const investigationContext = `## Investigation: ${incident.title}
Status: ${incident.status}
Root Cause: ${incident.rootCause ?? 'Not determined'}
Description: ${incident.description}

## Key Evidence
${evidenceSummary || 'No evidence available.'}${memoryContext}${historyContext}`;

        // Run follow-up agent with same Mastra Memory thread as the investigation
        let responseText: string;
        let costUsd = 0;
        try {
            const result = await this.deps.agentRunner.run({
                model: config.anthropic.agentModels.followup,
                maxTurns: 1,
                staticSystemPrompt: FOLLOWUP_SYSTEM_PROMPT,
                systemPrompt: investigationContext,
                userPrompt: message,
                tools: [],
                toolHandler: () => Promise.resolve(''),
                memory: {
                    thread: { id: `investigation-${incidentId}`, metadata: { incidentId: incidentId as string, type: 'investigation' } },
                    resource: tenantId as string,
                },
            });
            responseText = result.response;
            costUsd = result.costUsd ?? 0;
        } catch (err) {
            logger.warn({ err, tenantId, incidentId }, 'Follow-up agent unavailable — using investigation-context stub reply');
            responseText = this.buildStubFollowupReply(incident, message, evidenceSummary);
        }

        const slackThreadId = await this.mirrorToChatPlatform(
            tenantId,
            incident,
            responseText,
            incident.slackNotificationTs,
        );

        // Save response
        if (this.deps.chatHistory) {
            await this.deps.chatHistory.saveMessage({
                tenantId, chatId,
                messageId: `msg-${uuidv4().slice(0, 8)}`,
                role: 'assistant', content: responseText,
                costUsd, slackThreadId,
                createdAt: new Date().toISOString(),
            });
        }

        logger.info({ tenantId, incidentId, chatId, costUsd }, 'Investigation follow-up Q&A completed');

        // Dispatch a followup worker so subsequent messages go via WebSocket (richer experience)
        if (this.deps.dispatchFollowupWorker) {
            this.deps.dispatchFollowupWorker(incidentId as string, tenantId as string).catch((err) => {
                logger.warn({ err, incidentId }, 'Failed to dispatch followup worker — REST fallback will continue');
            });
        }

        return { response: responseText, chatId, action: 'question_answered' };
    }

    private buildStubFollowupReply(
        incident: { title: string; rootCause?: string },
        question: string,
        evidenceSummary: string,
    ): string {
        const rootCause = incident.rootCause ?? 'not yet determined';
        const evidenceHint = evidenceSummary
            ? ` Key evidence: ${evidenceSummary.slice(0, 400)}`
            : '';
        return `Based on the investigation "${incident.title}", the identified root cause is: ${rootCause}. ` +
            `Regarding your question "${question.slice(0, 200)}":${evidenceHint}`;
    }

    private async resolveChatPlatform(tenantId: TenantId): Promise<ChatPlatform | undefined> {
        if (!this.deps.chatPlatform) return undefined;
        if (!this.deps.tenantRepo) return this.deps.chatPlatform;

        const tenant = await this.deps.tenantRepo.findById(tenantId);
        const slackConfig = tenant?.settings?.slackConfig;
        if (tenant?.settings?.chatProvider === 'slack' && slackConfig?.accessToken && slackConfig.channelId) {
            try {
                let plainToken = slackConfig.accessToken;
                if (this.deps.tokenEncryption) {
                    try {
                        const encrypted = JSON.parse(slackConfig.accessToken) as EncryptedPayload;
                        if (encrypted.ciphertext && encrypted.encryptedDek) {
                            plainToken = await this.deps.tokenEncryption.decrypt(encrypted);
                        }
                    } catch { /* legacy plaintext token */ }
                }
                const { WebClient } = await import('@slack/web-api');
                const { SlackChatPlatform } = await import('../../../shared/infra/chat/slack-chat-platform.js');
                return new SlackChatPlatform(
                    new WebClient(plainToken),
                    this.deps.slackNotificationRepo!,
                    logger,
                );
            } catch (err) {
                logger.warn({ err, tenantId }, 'Failed to resolve Slack chat platform — falling back to web portal');
            }
        }
        return this.deps.chatPlatform;
    }

    private async mirrorToChatPlatform(
        tenantId: TenantId,
        incident: { slackNotificationTs?: string },
        text: string,
        threadId?: string,
    ): Promise<string | undefined> {
        const platform = await this.resolveChatPlatform(tenantId);
        if (!platform) return undefined;
        try {
            const tenant = this.deps.tenantRepo
                ? await this.deps.tenantRepo.findById(tenantId)
                : undefined;
            const channelId = tenant?.settings?.slackConfig?.channelId ?? (tenantId as string);
            const result = await platform.sendMessage({
                channelId,
                text,
                threadId: threadId ?? incident.slackNotificationTs,
            });
            return result.threadId;
        } catch (err) {
            logger.warn({ err, tenantId }, 'Failed to mirror investigation chat to chat platform');
            return undefined;
        }
    }

    async getHistory(tenantId: TenantId, incidentId: IncidentId): Promise<Array<{ role: string; content: string; createdAt: string; slackThreadId?: string }>> {
        if (!this.deps.chatHistory) return [];
        const chatId = `investigation-${incidentId}`;
        const messages = await this.deps.chatHistory.getChat(tenantId, chatId);
        return messages.map((m) => ({
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
            slackThreadId: m.slackThreadId,
        }));
    }
}

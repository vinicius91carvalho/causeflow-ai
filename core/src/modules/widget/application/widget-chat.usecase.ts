import { v4 as uuidv4 } from 'uuid';
import type { TenantId, WidgetSessionId } from '../../../shared/domain/value-objects.js';
import { widgetSessionId } from '../../../shared/domain/value-objects.js';
import type { ChatUseCase, ChatOutput } from '../../memory/application/chat.usecase.js';
import type { LLMClient } from '../../../shared/application/ports/llm-client.port.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { IWidgetSessionRepository } from '../domain/widget-session.repository.js';
import type { WidgetSession, WidgetMessage } from '../domain/widget-session.entity.js';
import type { DataMaskingConfig } from '../domain/data-masking.types.js';
import { DEFAULT_DATA_MASKING_CONFIG } from '../domain/data-masking.types.js';
import type { DataMasker } from './data-masker.js';
import type { ResponseFormatter, WidgetResponseMessage } from './response-formatter.js';
import type { FollowUpGenerator } from './follow-up-generator.js';
import { logger } from '../../../shared/infra/logger.js';

export interface WidgetChatInput {
    tenantId: TenantId;
    sessionId: WidgetSessionId;
    message: string;
    agentId?: string;
    agentName?: string;
}

export interface WidgetChatOutput {
    sessionId: WidgetSessionId;
    chatId: string;
    response: WidgetResponseMessage;
    status: 'completed' | 'processing';
    followUpQuestions?: string[];
}

export interface WidgetChatDeps {
    chatUseCase: ChatUseCase;
    sessionRepo: IWidgetSessionRepository;
    llmClient: LLMClient;
    tenantRepo: ITenantRepository;
    dataMasker: DataMasker;
    responseFormatter: ResponseFormatter;
    followUpGenerator: FollowUpGenerator;
}

const MAX_HISTORY_MESSAGES = 10;
const DEFAULT_SESSION_TTL_HOURS = 24;
const DEFAULT_MAX_SESSION_MESSAGES = 50;

export class WidgetChatUseCase {
    private deps: WidgetChatDeps;

    constructor(deps: WidgetChatDeps) {
        this.deps = deps;
    }

    async createSession(tenantId: TenantId, agentId?: string, agentName?: string): Promise<WidgetSession> {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + DEFAULT_SESSION_TTL_HOURS * 60 * 60 * 1000);

        const session: WidgetSession = {
            sessionId: widgetSessionId(`ws-${uuidv4().slice(0, 12)}`),
            tenantId,
            agentId,
            agentName,
            messages: [],
            status: 'active',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
        };

        await this.deps.sessionRepo.create(session);
        logger.info({ tenantId, sessionId: session.sessionId, agentId }, 'Widget session created');
        return session;
    }

    async execute(input: WidgetChatInput): Promise<WidgetChatOutput> {
        const { tenantId, sessionId, message } = input;

        // Load session
        const session = await this.deps.sessionRepo.findById(tenantId, sessionId);
        if (!session || session.status !== 'active') {
            throw new Error('Session not found or closed');
        }

        // Load tenant for masking config
        const tenant = await this.deps.tenantRepo.findById(tenantId);
        const maskingConfig: DataMaskingConfig = tenant?.settings?.widgetConfig?.dataMasking ?? DEFAULT_DATA_MASKING_CONFIG;
        const maxMessages = tenant?.settings?.widgetConfig?.maxSessionMessages ?? DEFAULT_MAX_SESSION_MESSAGES;

        // Check message limit
        if (session.messages.length >= maxMessages) {
            return {
                sessionId,
                chatId: `chat-${uuidv4().slice(0, 8)}`,
                response: { text: 'Esta sessão atingiu o limite de mensagens. Por favor, inicie uma nova conversa.' },
                status: 'completed',
            };
        }

        // Save user message
        const userMessage: WidgetMessage = {
            role: 'user',
            content: message,
            timestamp: new Date().toISOString(),
        };
        await this.deps.sessionRepo.appendMessage(tenantId, sessionId, userMessage);

        // Build context from history
        const contextMessage = this.buildContextMessage(message, session.messages);

        // Try follow-up questions first (if message is ambiguous)
        if (session.messages.filter((m) => m.role === 'user').length === 0) {
            // First message — check if we need follow-ups
            const followUps = await this.deps.followUpGenerator.generate(message, session.messages);
            if (followUps) {
                const assistantMsg: WidgetMessage = {
                    role: 'assistant',
                    content: followUps.join('\n'),
                    timestamp: new Date().toISOString(),
                    followUpQuestions: followUps,
                };
                await this.deps.sessionRepo.appendMessage(tenantId, sessionId, assistantMsg);

                return {
                    sessionId,
                    chatId: `chat-${uuidv4().slice(0, 8)}`,
                    response: { text: 'Para investigar melhor, preciso de mais detalhes:' },
                    status: 'completed',
                    followUpQuestions: followUps,
                };
            }
        }

        // Delegate to ChatUseCase
        const chatOutput: ChatOutput = await this.deps.chatUseCase.execute({
            tenantId,
            message: contextMessage,
        });

        // Format response
        const response = this.deps.responseFormatter.formatChatResponse(chatOutput);

        // Apply data masking
        response.text = this.deps.dataMasker.mask(response.text, maskingConfig);
        if (response.summary) response.summary = this.deps.dataMasker.mask(response.summary, maskingConfig);
        if (response.impact) response.impact = this.deps.dataMasker.mask(response.impact, maskingConfig);
        if (response.resolution) response.resolution = this.deps.dataMasker.mask(response.resolution, maskingConfig);

        // Save assistant response
        const assistantMsg: WidgetMessage = {
            role: 'assistant',
            content: response.text,
            timestamp: new Date().toISOString(),
            chatId: chatOutput.chatId,
            intent: chatOutput.intent,
            incidentId: chatOutput.incidentId,
        };
        await this.deps.sessionRepo.appendMessage(tenantId, sessionId, assistantMsg);

        return {
            sessionId,
            chatId: chatOutput.chatId,
            response,
            status: chatOutput.status,
        };
    }

    private buildContextMessage(currentMessage: string, history: WidgetMessage[]): string {
        if (history.length === 0) return currentMessage;

        const recentHistory = history.slice(-MAX_HISTORY_MESSAGES);
        const contextLines = recentHistory.map((m) =>
            `${m.role === 'user' ? 'Support Agent' : 'CauseFlow'}: ${m.content}`,
        );

        return `[Conversation context]\n${contextLines.join('\n')}\n\n[Current message]\nSupport Agent: ${currentMessage}`;
    }
}

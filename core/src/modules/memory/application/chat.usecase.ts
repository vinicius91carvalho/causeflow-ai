import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { incidentId } from '../../../shared/domain/value-objects.js';
import { LOG_TOOLS, METRIC_TOOLS } from '../../investigation/infra/investigation-tools.js';
import { MEMORY_TOOLS } from '../../investigation/infra/memory-tools.js';
import { logger } from '../../../shared/infra/logger.js';
import type { AgentRunner } from '../../../shared/application/ports/agent-runner.port.js';
import type { LLMClient } from '../../../shared/application/ports/llm-client.port.js';
import type { CloudProvider } from '../../../shared/application/ports/cloud-provider.port.js';
import type { CredentialVendor } from '../../../shared/application/ports/credential-vendor.port.js';
import type { AgentMemory } from '../../../shared/application/ports/agent-memory.port.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { MessageQueue } from '../../../shared/application/ports/message-queue.port.js';
import type { SSEManager } from '../../../shared/infra/chat/sse-manager.js';
import type { ToolHandlerFactory } from '../../investigation/application/investigate-incident.usecase.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { IChatHistoryRepository } from '../domain/chat-message.entity.js';
import type { ReserveInvestigationUseCase } from '../../billing/application/reserve-investigation.usecase.js';

export type ChatIntent = 'memory_only' | 'live_check' | 'incident' | 'general' | 'knowledge';

interface ClassifiedIntent {
    intent: ChatIntent;
    service?: string;
    timeWindow?: string;
    title?: string;
    reasoning?: string;
}

export interface ChatInput {
    tenantId: TenantId;
    message: string;
    actorUserId?: string;
    actorEmail?: string;
}

export interface ChatOutput {
    chatId: string;
    message: string;
    intent: ChatIntent;
    status: 'completed' | 'processing';
    answer?: string;
    incidentId?: string;
    incidentUrl?: string;
    service?: string;
    liveDataChecked?: boolean;
}

export interface ChatUseCaseDeps {
    agentRunner: AgentRunner;
    llmClient: LLMClient;
    cloudProvider: CloudProvider;
    credentialVendor?: CredentialVendor;
    agentMemory: AgentMemory;
    incidentRepo: IIncidentRepository;
    eventBus: IEventBus;
    sseManager: SSEManager;
    toolHandlerFactory: ToolHandlerFactory;
    messageQueue?: MessageQueue;
    investigationQueueUrl?: string;
    defaultRegion?: string;
    chatHistory?: IChatHistoryRepository;
    reserveInvestigation?: ReserveInvestigationUseCase;
}

const classifiedIntentSchema = z.object({
    intent: z.enum(['knowledge', 'incident', 'live_check', 'memory_only', 'general']),
    service: z.string().nullable().optional(),
    timeWindow: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    reasoning: z.string().optional(),
});

const ROUTER_PROMPT = `You are an intent classifier for an AI SRE platform. Classify the user message into exactly one intent.

Intents:
- "knowledge": User is TELLING us facts about their system (architecture, tech stack, repos, integrations, how things work). Declarative statements, not questions. Example: "Nosso sistema usa ECS para o core e Lambda para webhooks. Código no CodeCommit."
- "incident": Something is BROKEN — customer complaints, service failures, outages that need formal investigation. Example: "Cliente não recebeu o pagamento", "API retornando 500"
- "live_check": User is ASKING about what's happening RIGHT NOW — current errors, recent deploy health, live status. Example: "Tem erros depois do deploy?", "O serviço está saudável?"
- "memory_only": User is ASKING a question that can be answered from past knowledge — history, architecture, patterns, previous incidents. Example: "Onde fica o código?", "O que causou as falhas semana passada?", "Quais serviços usamos?"
- "general": Greetings or help requests. Example: "Olá", "O que você faz?"`;
const LIVE_CHECK_PROMPT = `You are an SRE on-demand assistant for CauseFlow. An engineer is asking about their live infrastructure.

Your job:
1. Use aws_api_call to check LIVE data:
   - service "logs", action "FilterLogEvents" to query CloudWatch logs
   - service "cloudwatch", action "GetMetricData" to query metrics
   - service "ecs", action "DescribeServices" to check service health
   - service "sqs", action "GetQueueAttributes" to check queue depth
2. Use memory tools (recall_past_incidents, get_service_topology) for historical context
3. Provide a concise, evidence-based answer

Cite specific data: error counts, latency values, timestamps.
If no issues found, say so clearly with evidence.
If problems found, explain severity and recommend next steps.

Keep response under 500 words. Be direct.`;
// ─── Use Case ────────────────────────────────────────────────────────
export class ChatUseCase {
    deps;
    constructor(deps: ChatUseCaseDeps) {
        this.deps = deps;
    }
    async execute(input: ChatInput): Promise<ChatOutput> {
        const { tenantId, message, actorUserId, actorEmail } = input;
        const chatId = `chat-${uuidv4().slice(0, 8)}`;
        const now = new Date().toISOString();

        // Save user message
        await this.saveUserMessage(tenantId, chatId, message, now);

        // 1. Route: classify intent (Haiku — fast, cheap, ~500ms)
        const classified = await this.classifyIntent(message);
        logger.info({ tenantId, chatId, intent: classified.intent, service: classified.service }, 'Chat intent classified');

        let result: ChatOutput;
        switch (classified.intent) {
            case 'general': {
                const answer = this.handleGeneral(message);
                result = { chatId, message, intent: 'general', status: 'completed', answer };
                await this.saveAssistantMessage(tenantId, chatId, answer, 'general', 'completed');
                return result;
            }
            case 'memory_only': {
                const answer = await this.handleMemoryOnly(tenantId, message);
                result = { chatId, message, intent: 'memory_only', status: 'completed', answer };
                await this.saveAssistantMessage(tenantId, chatId, answer, 'memory_only', 'completed');
                return result;
            }
            case 'live_check':
                // Dispatch async — respond immediately, send result via SSE
                this.dispatchLiveCheck(tenantId, chatId, message, classified.service, classified.timeWindow);
                return {
                    chatId, message, intent: 'live_check', status: 'processing',
                    service: classified.service,
                };
            case 'knowledge': {
                const answer = await this.handleKnowledge(tenantId, message);
                result = { chatId, message, intent: 'knowledge', status: 'completed', answer };
                await this.saveAssistantMessage(tenantId, chatId, answer, 'knowledge', 'completed');
                return result;
            }
            case 'incident':
                return this.handleIncident(tenantId, chatId, message, classified, actorUserId, actorEmail);
            default: {
                const _exhaustive: never = classified.intent;
                throw new Error(`Unknown intent: ${String(_exhaustive)}`);
            }
        }
    }

    // ─── Chat History Helpers ────────────────────────────────────────
    private async saveUserMessage(tenantId: TenantId, chatId: string, content: string, createdAt: string): Promise<void> {
        if (!this.deps.chatHistory) return;
        try {
            await this.deps.chatHistory.saveMessage({
                tenantId,
                chatId,
                messageId: `msg-${uuidv4().slice(0, 8)}`,
                role: 'user',
                content,
                createdAt,
            });
        } catch (err) {
            logger.warn({ err, tenantId, chatId }, 'Failed to save user chat message');
        }
    }

    private async saveAssistantMessage(
        tenantId: TenantId, chatId: string, content: string,
        intent: ChatIntent, status: 'completed' | 'processing' | 'error',
        extra?: { costUsd?: number; liveDataChecked?: boolean; toolCallsCount?: number },
    ): Promise<void> {
        if (!this.deps.chatHistory) return;
        try {
            await this.deps.chatHistory.saveMessage({
                tenantId,
                chatId,
                messageId: `msg-${uuidv4().slice(0, 8)}`,
                role: 'assistant',
                content,
                intent,
                status,
                costUsd: extra?.costUsd,
                liveDataChecked: extra?.liveDataChecked,
                toolCallsCount: extra?.toolCallsCount,
                createdAt: new Date().toISOString(),
            });
        } catch (err) {
            logger.warn({ err, tenantId, chatId }, 'Failed to save assistant chat message');
        }
    }
    // ─── Router ──────────────────────────────────────────────────────
    async classifyIntent(message: string): Promise<ClassifiedIntent> {
        try {
            const result = await this.deps.llmClient.complete<ClassifiedIntent>({
                model: 'claude-sonnet-4-6',
                systemPrompt: ROUTER_PROMPT,
                userPrompt: message,
                maxTokens: 200,
                temperature: 0,
                responseSchema: classifiedIntentSchema,
            });
            const parsed = result.content;
            return {
                intent: parsed.intent,
                service: parsed.service ?? undefined,
                timeWindow: parsed.timeWindow ?? undefined,
                title: parsed.title ?? undefined,
                reasoning: parsed.reasoning,
            };
        }
        catch {
            // fallback to heuristic
        }
        // Heuristic fallback (only if structured output fails)
        return { intent: 'memory_only', reasoning: 'classifier fallback' };
    }
    // ─── Live Check (async — dispatches in background, result via SSE) ─
    dispatchLiveCheck(tenantId: TenantId, chatId: string, message: string, service: string | undefined, timeWindow: string | undefined): void {
        // Fire-and-forget — runs in background, sends result via SSE
        this.runLiveCheck(tenantId, chatId, message, service, timeWindow).catch((err) => {
            logger.error({ err, tenantId, chatId }, 'Live check failed');
            const errorAnswer = 'Failed to check live data. Please try again.';
            this.saveAssistantMessage(tenantId, chatId, errorAnswer, 'live_check', 'error').catch(() => { });
            this.deps.sseManager.broadcast(tenantId, {
                event: 'chat.response',
                data: {
                    chatId,
                    intent: 'live_check',
                    status: 'error',
                    answer: errorAnswer,
                    liveDataChecked: false,
                },
            }).catch(() => { });
        });
    }
    async runLiveCheck(tenantId: TenantId, chatId: string, message: string, service: string | undefined, timeWindow: string | undefined): Promise<void> {
        logger.info({ tenantId, chatId, service, timeWindow }, 'Live check started');
        const syntheticId = incidentId(`chat-${chatId}`);
        // Recall historical context
        let memoryContext = '';
        try {
            const memories = await this.deps.agentMemory.recall(tenantId, message, {
                maxResults: 3, budget: 'low',
            });
            if (memories.length > 0) {
                memoryContext = '\n\nHistorical context:\n' + memories.map((m) => `- ${m.text}`).join('\n');
            }
        }
        catch { /* non-critical */ }
        // Vend credentials
        const cloudCredentials = this.deps.credentialVendor
            ? await this.deps.credentialVendor.vend({
                tenantId: tenantId,
                incidentId: syntheticId,
                agentRole: 'log_analyst',
                provider: this.deps.cloudProvider.name,
                requestedPermissions: [],
            })
            : { provider: 'stub', credentials: {}, region: this.deps.defaultRegion ?? 'us-east-1' };
        // Deduplicated tool set
        const tools = [...new Map([...LOG_TOOLS, ...METRIC_TOOLS, ...MEMORY_TOOLS].map((t) => [t.name, t])).values()];
        const toolHandler = this.deps.toolHandlerFactory({
            cloudProvider: this.deps.cloudProvider,
            cloudCredentials,
            incidentRepo: this.deps.incidentRepo,
            tenantId,
            incidentId: syntheticId,
            agentMemory: this.deps.agentMemory,
        });
        const serviceHint = service ? `\nService: ${service}` : '';
        const timeHint = timeWindow ? `\nTime window: ${timeWindow}` : '\nTime window: last 1 hour';
        const agentResult = await this.deps.agentRunner.run({
            systemPrompt: LIVE_CHECK_PROMPT,
            userPrompt: `${message}${serviceHint}${timeHint}${memoryContext}`,
            tools,
            toolHandler,
            maxTurns: 5,
            maxTokens: 2000,
            temperature: 0,
        });
        const liveDataChecked = agentResult.toolCalls.some((tc) => tc.name === 'aws_api_call');
        logger.info({ tenantId, chatId, liveDataChecked, toolCallsCount: agentResult.toolCalls.length, costUsd: agentResult.costUsd }, 'Live check completed');

        // Save assistant response
        await this.saveAssistantMessage(tenantId, chatId, agentResult.response, 'live_check', 'completed', {
            costUsd: agentResult.costUsd,
            liveDataChecked,
            toolCallsCount: agentResult.toolCalls.length,
        });

        // Send result via SSE
        await this.deps.sseManager.broadcast(tenantId, {
            event: 'chat.response',
            data: {
                chatId,
                intent: 'live_check',
                status: 'completed',
                answer: agentResult.response,
                liveDataChecked,
                toolCallsCount: agentResult.toolCalls.length,
                costUsd: agentResult.costUsd,
            },
        });
        // Retain for future context
        try {
            await this.deps.agentMemory.retain(tenantId, `Engineer asked: "${message}". Live check result: ${agentResult.response.slice(0, 500)}.`, { tags: ['chat', 'live_check', ...(service ? [`service:${service}`] : [])], context: `chat:${chatId}` });
        }
        catch { /* non-critical */ }
    }
    // ─── Incident (creates real incident → dispatches investigation via SQS/Fargate) ─
    async handleIncident(tenantId: TenantId, chatId: string, message: string, classified: ClassifiedIntent, actorUserId?: string, actorEmail?: string): Promise<ChatOutput> {
        // Reserve investigation credit before creating incident
        if (this.deps.reserveInvestigation) {
            const reservation = await this.deps.reserveInvestigation.execute(tenantId);
            if (!reservation.reserved) {
                const answer = 'Investigation limit reached. Please upgrade your plan to continue.';
                await this.saveAssistantMessage(tenantId, chatId, answer, 'incident', 'error');
                return {
                    chatId,
                    message,
                    intent: 'incident' as const,
                    status: 'completed' as const,
                    answer,
                };
            }
        }
        const title = classified.title || message.slice(0, 100);
        // Create incident via the ingestion pipeline
        const now = new Date().toISOString();
        const incId = incidentId(uuidv4());
        await this.deps.incidentRepo.create({
            tenantId,
            incidentId: incId,
            title,
            description: message,
            severity: 'medium',
            status: 'open',
            sourceProvider: 'chat',
            sourceAlertId: chatId,
            createdAt: now,
            updatedAt: now,
        });
        // Publish event → triggers triage → investigation pipeline
        await this.deps.eventBus.publish({
            eventType: 'incident.created',
            occurredAt: now,
            tenantId: tenantId,
            payload: { incidentId: incId, severity: 'medium', title, actorUserId, actorEmail },
        });
        // Enqueue for triage (which will dispatch investigation)
        if (this.deps.messageQueue && this.deps.investigationQueueUrl) {
            await this.deps.messageQueue.send(this.deps.investigationQueueUrl, {
                incidentId: incId,
                tenantId: tenantId,
                suggestedAgents: ['log_analyst', 'metric_analyst', 'infra_inspector'],
            });
        }
        logger.info({ tenantId, chatId, incidentId: incId, title }, 'Incident created from chat');
        return {
            chatId,
            message,
            intent: 'incident' as const,
            status: 'processing' as const,
            incidentId: incId,
            incidentUrl: `/dashboard/analyses/${incId}`,
            service: classified.service,
        };
    }
    // ─── Knowledge (user teaching the system about their infra) ────────
    async handleKnowledge(tenantId: TenantId, message: string): Promise<string> {
        // Extract structured tags from the message using structured output
        const knowledgeExtractionSchema = z.object({
            services: z.array(z.string()),
            categories: z.array(z.enum(['topology', 'deployment', 'architecture', 'repository', 'dependency', 'process'])),
            summary: z.string(),
        });
        let tags = ['infrastructure', 'user_provided'];
        let services: string[] = [];
        try {
            const extraction = await this.deps.llmClient.complete<z.infer<typeof knowledgeExtractionSchema>>({
                model: 'claude-haiku-4-5',
                systemPrompt: 'Extract metadata from this infrastructure description.',
                userPrompt: message,
                maxTokens: 200,
                temperature: 0,
                responseSchema: knowledgeExtractionSchema,
            });
            const parsed = extraction.content;
            services = parsed.services ?? [];
            tags = [
                'infrastructure', 'user_provided',
                ...(parsed.categories ?? []),
                ...services.map(s => `service:${s}`),
            ];
        } catch { /* use default tags */ }

        // Retain in Hindsight
        await this.deps.agentMemory.retain(tenantId, message, {
            tags,
            context: `user-knowledge:${new Date().toISOString()}`,
        });

        logger.info({ tenantId, tags, services }, 'Knowledge retained from chat');

        const serviceList = services.length > 0 ? ` (${services.join(', ')})` : '';
        return `Got it! I've learned this about your infrastructure${serviceList}. This knowledge will be used in future investigations to give better context and faster root cause analysis.`;
    }

    // ─── Memory Only (Hindsight reflect — sync, fast) ────────────────
    async handleMemoryOnly(tenantId: TenantId, message: string): Promise<string> {
        const answer = await this.deps.agentMemory.reflect(tenantId, message, { budget: 'high' });
        return answer || 'I don\'t have enough data yet. Memory builds automatically from investigations.';
    }
    // ─── General (static responses) ──────────────────────────────────
    handleGeneral(message: string): string {
        const lower = message.toLowerCase().trim();
        if (lower.match(/^(hi|hello|hey|oi|olá)/)) {
            return 'Hello! I\'m CauseFlow. Ask me anything about your infrastructure — I can check live logs, recall past incidents, or start a full investigation.';
        }
        if (lower.includes('help') || lower.includes('ajuda')) {
            return 'I can help with:\n' +
                '• **"Any errors after the deploy?"** — checks live logs & metrics\n' +
                '• **"Client X didn\'t receive OTP"** — starts a full investigation\n' +
                '• **"What caused the failures last week?"** — recalls from memory\n' +
                '• **"Is payment-service healthy?"** — live health check\n' +
                '• **"Our code is in CodeCommit repo X"** — teaches me about your infrastructure';
        }
        return 'I\'m CauseFlow, your AI SRE assistant. I check live infrastructure data, recall past incidents, and investigate issues. What would you like to know?';
    }
}

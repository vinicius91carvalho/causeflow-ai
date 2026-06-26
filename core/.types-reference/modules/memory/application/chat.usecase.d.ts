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
export type ChatIntent = 'memory_only' | 'live_check' | 'incident' | 'general';
export interface ChatInput {
    tenantId: TenantId;
    message: string;
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
}
export declare class ChatUseCase {
    private readonly deps;
    constructor(deps: ChatUseCaseDeps);
    execute(input: ChatInput): Promise<ChatOutput>;
    private classifyIntent;
    private dispatchLiveCheck;
    private runLiveCheck;
    private handleIncident;
    private handleMemoryOnly;
    private handleGeneral;
}

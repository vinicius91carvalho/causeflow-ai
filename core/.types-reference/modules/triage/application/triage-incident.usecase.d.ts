import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { IEvidenceRepository } from '../domain/evidence.repository.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { LLMClient } from '../../../shared/application/ports/llm-client.port.js';
import type { MessageQueue } from '../../../shared/application/ports/message-queue.port.js';
import type { IntegrationToolProvider } from '../../../shared/application/ports/integration-tool-provider.port.js';
import type { TriageResult } from '../domain/triage.types.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
export interface TriageIncidentDeps {
    incidentRepo: IIncidentRepository;
    evidenceRepo: IEvidenceRepository;
    eventBus: IEventBus;
    llmClient: LLMClient;
    messageQueue?: MessageQueue;
    investigationQueueUrl?: string;
    minInvestigationSeverity?: string;
    integrationToolProvider?: IntegrationToolProvider;
    /** Whether the tenant has AWS credential vending configured */
    hasAwsCredentials?: boolean;
    /** Whether the tenant has GitHub App connected */
    hasGitHub?: boolean;
    /** Whether the tenant has Relay connected */
    hasRelay?: boolean;
}
export declare class TriageIncidentUseCase {
    private readonly incidentRepo;
    private readonly evidenceRepo;
    private readonly eventBus;
    private readonly llmClient;
    private readonly messageQueue?;
    private readonly investigationQueueUrl?;
    private readonly minInvestigationSeverity;
    private readonly integrationToolProvider?;
    private readonly hasAwsCredentials;
    private readonly hasGitHub;
    private readonly hasRelay;
    constructor(incidentRepo: IIncidentRepository, evidenceRepo: IEvidenceRepository, eventBus: IEventBus, llmClient: LLMClient, messageQueue?: MessageQueue, investigationQueueUrl?: string, minInvestigationSeverity?: string, integrationToolProvider?: IntegrationToolProvider, hasAwsCredentials?: boolean, hasGitHub?: boolean, hasRelay?: boolean);
    constructor(deps: TriageIncidentDeps);
    execute(tenantId: TenantId, incidentId: IncidentId): Promise<TriageResult>;
    /**
     * Build an integration-aware triage prompt.
     * Fetches connected integrations from the provider (fast, cached call)
     * and combines with static infra knowledge (AWS, GitHub, Relay).
     */
    private buildSmartPrompt;
}

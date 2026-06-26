import type { AgentRole } from '../../../shared/domain/types.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { CustomerExplanation } from '../../ingestion/domain/incident.entity.js';
import type { IInvestigationChannel } from '../../../shared/application/ports/investigation-channel.port.js';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface StructuredAction {
    action: string;
    label: string;
    description: string;
    rationale: string;
    riskLevel: RiskLevel;
    estimatedDuration: string;
    automated: boolean;
    params: Record<string, unknown>;
}
export interface ProposedFileChange {
    path: string;
    content: string;
    changeDescription: string;
}
export interface ProposedFix {
    repoFullName: string;
    files: ProposedFileChange[];
    summary: string;
    testSuggestions: string[];
    baseBranch?: string;
}
/**
 * A finding produced by the synthesizer. Each finding binds a human-readable
 * claim (`text`) to a list of evidence records that support it. The synthesizer
 * output schema requires `evidenceIds.length >= 1` and every id to resolve to a
 * real Evidence row persisted during the investigation (validated post-generate).
 *
 * `evidenceIds` is optional at the type level because runtime code that appends
 * synthetic findings (verification, falsification) may not have backing evidence.
 */
export interface Finding {
    text: string;
    evidenceIds?: string[];
}

export interface InvestigationResult {
    findings: Finding[];
    potentialRootCause: string;
    recommendedActions: StructuredAction[];
    evidence: Array<{
        type: string;
        content: string;
    }>;
    customerExplanation?: CustomerExplanation;
    proposedFix?: ProposedFix;
    failedAgents?: Array<{
        role: string;
        error: string;
    }>;
    knownSolutionPatternId?: string;
}
/** Describes which integrations a tenant has connected. */
export interface TenantCapabilities {
    hasAws: boolean;
    composioApps: string[];
    hasRelay: boolean;
}

/** Determines which base tool set an agent needs. */
export type AgentBaseRole = 'log' | 'metric' | 'infra' | 'change_detection' | 'scout' | 'verification' | 'composio_only' | 'db' | 'code' | 'orchestrator';

export interface SubAgentConfig {
    agentRole: AgentRole;
    /** Dynamic portion of system prompt (incident-specific context). Falls back to full prompt if staticSystemPrompt is not set. */
    systemPrompt: string;
    /** Static portion of system prompt (role description, tool guidance). Cached via prompt caching. */
    staticSystemPrompt?: string;
    /**
     * Static tools for agents whose tools are NOT assembled dynamically.
     * When baseRole is set, tools are assembled at runtime instead.
     */
    tools: ToolDefinition[];
    /** Determines which base tools to include. When set, tools are assembled dynamically per tenant capabilities. */
    baseRole?: AgentBaseRole;
    maxTurns: number;
    /** Minimum tool calls before agent can conclude. Prevents shallow investigations. */
    minToolCalls?: number;
    model?: string;
    useCodeExecution?: boolean;
    wave?: 0 | 1 | 2 | 3;
}
export interface SubAgentResult {
    agentRole: AgentRole;
    findings: string[];
    confidence: number;
    toolCallsMade: number;
    usage: {
        inputTokens: number;
        outputTokens: number;
        cacheReadInputTokens?: number;
        cacheCreationInputTokens?: number;
    };
    model: string;
    costUsd: number;
    wave?: 0 | 1 | 2 | 3;
    truncatedResults?: number;
    parallelBatches?: number;
    retryCount?: number;
}
export interface InvestigationInput {
    incidentId: IncidentId;
    tenantId: TenantId;
    suggestedAgents: string[];
    /** Optional bidirectional channel for real-time user interaction */
    channel?: IInvestigationChannel;
    /** Optional Mastra Memory config for conversation persistence */
    memory?: {
        thread: { id: string; metadata?: Record<string, unknown> };
        resource: string;
    };
}

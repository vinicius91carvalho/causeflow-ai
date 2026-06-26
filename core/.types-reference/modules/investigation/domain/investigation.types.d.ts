import type { AgentRole } from '../../../shared/domain/types.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { CustomerExplanation } from '../../ingestion/domain/incident.entity.js';
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
export interface InvestigationResult {
    findings: string[];
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
export interface SubAgentConfig {
    agentRole: AgentRole;
    systemPrompt: string;
    tools: ToolDefinition[];
    maxTurns: number;
    model?: string;
    useCodeExecution?: boolean;
    wave?: 1 | 2;
}
export interface SubAgentResult {
    agentRole: AgentRole;
    findings: string[];
    confidence: number;
    toolCallsMade: number;
    usage: {
        inputTokens: number;
        outputTokens: number;
    };
    model: string;
    costUsd: number;
    wave?: 1 | 2;
}
export interface InvestigationInput {
    incidentId: IncidentId;
    tenantId: TenantId;
    suggestedAgents: string[];
}

import { z } from 'zod';
import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { CloudProvider, CloudCredentials } from '../../../shared/application/ports/cloud-provider.port.js';
import type { IIncidentRepository } from '../../ingestion/domain/incident.repository.js';
import type { TenantId, IncidentId } from '../../../shared/domain/value-objects.js';
import type { AgentMemory } from '../../../shared/application/ports/agent-memory.port.js';
import type { ICodeRepository } from '../../../shared/application/ports/code-repository.port.js';
import type { ICodeKnowledgeRepository } from '../../code-intelligence/domain/code-knowledge.repository.js';
import type { IRelayGateway } from '../../../shared/application/ports/relay-gateway.port.js';
import type { OAuthTokenStore } from '../../../shared/application/ports/oauth-token-store.port.js';
import type { IntegrationToolProvider } from '../../../shared/application/ports/integration-tool-provider.port.js';
export declare const queryLogsInputSchema: z.ZodObject<{
    service: z.ZodString;
    filter: z.ZodOptional<z.ZodString>;
    startTime: z.ZodOptional<z.ZodString>;
    endTime: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    service: string;
    filter?: string | undefined;
    limit?: number | undefined;
    startTime?: string | undefined;
    endTime?: string | undefined;
}, {
    service: string;
    filter?: string | undefined;
    limit?: number | undefined;
    startTime?: string | undefined;
    endTime?: string | undefined;
}>;
export declare const queryMetricsInputSchema: z.ZodObject<{
    metricName: z.ZodString;
    namespace: z.ZodString;
    startTime: z.ZodOptional<z.ZodString>;
    endTime: z.ZodOptional<z.ZodString>;
    period: z.ZodOptional<z.ZodNumber>;
    stat: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    metricName: string;
    namespace: string;
    startTime?: string | undefined;
    endTime?: string | undefined;
    period?: number | undefined;
    stat?: string | undefined;
}, {
    metricName: string;
    namespace: string;
    startTime?: string | undefined;
    endTime?: string | undefined;
    period?: number | undefined;
    stat?: string | undefined;
}>;
export declare const describeServiceInputSchema: z.ZodObject<{
    serviceName: z.ZodString;
    region: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    serviceName: string;
    region?: string | undefined;
}, {
    serviceName: string;
    region?: string | undefined;
}>;
export declare const getIncidentDetailsInputSchema: z.ZodObject<{
    tenantId: z.ZodString;
    incidentId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    incidentId: string;
}, {
    tenantId: string;
    incidentId: string;
}>;
export declare const incidentDetailsTool: ToolDefinition;
export declare const LOG_TOOLS: ToolDefinition[];
export declare const METRIC_TOOLS: ToolDefinition[];
export declare const INFRA_TOOLS: ToolDefinition[];
export declare const CHANGE_DETECTION_TOOLS: ToolDefinition[];
export interface ToolHandlerDeps {
    cloudProvider: CloudProvider;
    cloudCredentials: CloudCredentials;
    incidentRepo: IIncidentRepository;
    tenantId: TenantId;
    incidentId: IncidentId;
    agentMemory?: AgentMemory;
    codeRepo?: ICodeRepository;
    codeKnowledgeRepo?: ICodeKnowledgeRepository;
    knownRepos?: string[];
    relayGateway?: IRelayGateway;
    oauthTokenStore?: OAuthTokenStore;
    integrationToolProvider?: IntegrationToolProvider;
}
export declare function createToolHandler(deps: ToolHandlerDeps): (name: string, input: Record<string, unknown>) => Promise<string>;

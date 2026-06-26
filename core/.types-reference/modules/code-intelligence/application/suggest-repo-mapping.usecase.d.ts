import type { ICodeKnowledgeRepository } from '../domain/code-knowledge.repository.js';
import type { AgentMemory } from '../../../shared/application/ports/agent-memory.port.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface RepoSuggestion {
    repoFullName: string;
    serviceId: string;
    score: number;
    reason: string;
}
export declare class SuggestRepoMappingUseCase {
    private readonly codeKnowledgeRepo;
    private readonly agentMemory?;
    constructor(codeKnowledgeRepo: ICodeKnowledgeRepository, agentMemory?: AgentMemory | undefined);
    execute(tenantId: TenantId): Promise<RepoSuggestion[]>;
    private discoverServices;
}

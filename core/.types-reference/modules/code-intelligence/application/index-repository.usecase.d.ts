import type { ICodeKnowledgeRepository } from '../domain/code-knowledge.repository.js';
import type { ICodeRepository } from '../../../shared/application/ports/code-repository.port.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface IndexRepositoryInput {
    tenantId: TenantId;
    repoFullName: string;
    ref?: string;
}
export declare class IndexRepositoryUseCase {
    private readonly codeKnowledgeRepo;
    private readonly codeRepoFactory;
    private readonly eventBus;
    constructor(codeKnowledgeRepo: ICodeKnowledgeRepository, codeRepoFactory: (tenantId: TenantId) => ICodeRepository | undefined, eventBus: IEventBus);
    execute(input: IndexRepositoryInput): Promise<void>;
}

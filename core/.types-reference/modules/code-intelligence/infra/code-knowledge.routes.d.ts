import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { ICodeKnowledgeRepository } from '../domain/code-knowledge.repository.js';
import type { SuggestRepoMappingUseCase } from '../application/suggest-repo-mapping.usecase.js';
export interface CodeKnowledgeUseCases {
    codeKnowledgeRepo: ICodeKnowledgeRepository;
    suggestRepoMapping: SuggestRepoMappingUseCase;
}
export declare function createCodeKnowledgeRoutes(useCases: CodeKnowledgeUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/">;

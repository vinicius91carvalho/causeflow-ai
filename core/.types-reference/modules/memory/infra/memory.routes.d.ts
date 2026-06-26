import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { AgentMemory } from '../../../shared/application/ports/agent-memory.port.js';
import type { IRunbookRegistryRepository } from '../../../shared/domain/runbook-registry.repository.js';
import type { ChatUseCase } from '../application/chat.usecase.js';
export interface MemoryUseCases {
    agentMemory: AgentMemory;
    runbookRegistry: IRunbookRegistryRepository;
    chat?: ChatUseCase;
}
export declare function createMemoryRoutes(deps: MemoryUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/">;

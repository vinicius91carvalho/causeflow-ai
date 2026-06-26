import type { IEventBus } from '../../domain/events.js';
import type { AgentMemory } from '../ports/agent-memory.port.js';
import type { IRunbookRegistryRepository } from '../../domain/runbook-registry.repository.js';
export declare function registerInvestigationToMemorySubscriber(deps: {
    eventBus: IEventBus;
    agentMemory: AgentMemory;
    runbookRegistry?: IRunbookRegistryRepository;
}): void;

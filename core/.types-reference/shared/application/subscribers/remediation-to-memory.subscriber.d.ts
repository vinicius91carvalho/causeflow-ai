import type { IEventBus } from '../../domain/events.js';
import type { AgentMemory } from '../ports/agent-memory.port.js';
export declare function registerRemediationToMemorySubscriber(deps: {
    eventBus: IEventBus;
    agentMemory: AgentMemory;
}): void;

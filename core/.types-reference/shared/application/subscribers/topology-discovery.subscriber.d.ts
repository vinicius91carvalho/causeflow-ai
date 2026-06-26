import type { IEventBus } from '../../domain/events.js';
import type { AgentMemory } from '../ports/agent-memory.port.js';
/**
 * Extracts service names from investigation findings and retains
 * discovered topology relationships in Hindsight memory.
 */
export declare function registerTopologyDiscoverySubscriber(deps: {
    eventBus: IEventBus;
    agentMemory: AgentMemory;
}): void;

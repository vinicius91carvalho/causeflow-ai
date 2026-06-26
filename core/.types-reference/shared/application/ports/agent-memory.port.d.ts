export interface MemoryEntry {
    text: string;
    type: 'world' | 'observation';
    score?: number;
}
export interface RetainOptions {
    context?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
}
export interface RecallOptions {
    maxResults?: number;
    types?: Array<'world' | 'observation'>;
    tags?: string[];
    tagsMatch?: 'any' | 'all' | 'any_strict' | 'all_strict';
    budget?: 'low' | 'mid' | 'high';
}
export interface ReflectOptions {
    budget?: 'low' | 'mid' | 'high';
    context?: string;
    tags?: string[];
    tagsMatch?: 'any' | 'all' | 'any_strict' | 'all_strict';
}
export interface BankConfig {
    reflectMission: string;
    retainMission: string;
    observationsMission: string;
    disposition: {
        skepticism: number;
        literalism: number;
        empathy: number;
    };
    directives?: Array<{
        name: string;
        content: string;
        priority?: number;
    }>;
}
export interface AgentMemory {
    /**
     * Store investigation facts as memories for future recall.
     */
    retain(tenantId: string, content: string, options?: RetainOptions): Promise<void>;
    /**
     * Search memories relevant to a query.
     */
    recall(tenantId: string, query: string, options?: RecallOptions): Promise<MemoryEntry[]>;
    /**
     * Synthesize memories into high-level observations via agentic reasoning.
     */
    reflect(tenantId: string, query: string, options?: ReflectOptions): Promise<string>;
    /**
     * Configure the Hindsight bank for a tenant (mission, disposition, directives).
     */
    configureBank(tenantId: string, config: BankConfig): Promise<void>;
}

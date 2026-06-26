import type { AgentMemory, MemoryEntry, RetainOptions, RecallOptions, ReflectOptions, BankConfig } from '../../application/ports/agent-memory.port.js';
export interface HindsightAgentMemoryConfig {
    baseUrl: string;
    apiKey?: string;
}
export declare class HindsightAgentMemory implements AgentMemory {
    private readonly client;
    private readonly knownBanks;
    constructor(config: HindsightAgentMemoryConfig);
    retain(tenantId: string, content: string, options?: RetainOptions): Promise<void>;
    recall(tenantId: string, query: string, options?: RecallOptions): Promise<MemoryEntry[]>;
    reflect(tenantId: string, query: string, options?: ReflectOptions): Promise<string>;
    configureBank(tenantId: string, config: BankConfig): Promise<void>;
    private toBankId;
    private ensureBank;
    private toStringRecord;
}

export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
}
export interface AgentRunConfig {
    model?: string;
    systemPrompt: string;
    userPrompt: string;
    tools: ToolDefinition[];
    toolHandler: (name: string, input: Record<string, unknown>) => Promise<string>;
    maxTurns?: number;
    maxTokens?: number;
    temperature?: number;
    useCodeExecution?: boolean;
    containerId?: string;
    signal?: AbortSignal;
}
export interface ToolCallRecord {
    name: string;
    input: Record<string, unknown>;
    output: string;
}
export interface AgentRunResult {
    response: string;
    toolCalls: ToolCallRecord[];
    totalUsage: {
        inputTokens: number;
        outputTokens: number;
    };
    turns: number;
    model: string;
    costUsd: number;
}
export interface AgentRunner {
    run(config: AgentRunConfig): Promise<AgentRunResult>;
}

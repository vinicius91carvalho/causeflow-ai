import type { AgentRunner, AgentRunConfig, AgentRunResult } from '../../application/ports/agent-runner.port.js';
export declare class AnthropicAgentRunner implements AgentRunner {
    private readonly client;
    constructor();
    run(agentConfig: AgentRunConfig): Promise<AgentRunResult>;
}

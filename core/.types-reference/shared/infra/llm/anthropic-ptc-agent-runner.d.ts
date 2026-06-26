/**
 * Anthropic PTC (Programmatic Tool Calling) Agent Runner
 *
 * Uses manual message loop with code_execution server tool instead of
 * client.beta.messages.toolRunner(). This enables:
 *  - Code execution: Claude writes code that calls our tools in a loop
 *  - Container reuse across turns (via container ID tracking)
 *  - Handling both client-side and server-side tool blocks
 *
 * The legacy AnthropicAgentRunner remains as fallback (feature flag).
 */
import type { AgentRunner, AgentRunConfig, AgentRunResult } from '../../application/ports/agent-runner.port.js';
export interface PTCAgentRunConfig extends AgentRunConfig {
    useCodeExecution?: boolean;
    containerId?: string;
}
export declare class AnthropicPTCAgentRunner implements AgentRunner {
    private readonly client;
    constructor();
    run(agentConfig: AgentRunConfig): Promise<AgentRunResult>;
}

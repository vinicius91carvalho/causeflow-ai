import type { AgentRunner, AgentRunConfig, AgentRunResult } from '../../application/ports/agent-runner.port.js';
import type { Tracer } from '../../application/ports/tracer.port.js';
import type { MetricRecorder } from '../../application/ports/metric-recorder.port.js';
export declare class ObservedAgentRunner implements AgentRunner {
    private readonly inner;
    private readonly tracer;
    private readonly metrics;
    constructor(inner: AgentRunner, tracer: Tracer, metrics: MetricRecorder);
    run(agentConfig: AgentRunConfig): Promise<AgentRunResult>;
}

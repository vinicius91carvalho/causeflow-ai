export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Max chars before truncation. Default: 50_000 */
  maxResultChars?: number;
  /** Whether this tool can run in parallel with others. Default: true */
  isConcurrencySafe?: boolean;
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
  /** Max parallel tool executions per batch. Default: 10 */
  maxToolConcurrency?: number;
  /** Max API retry attempts on transient errors. Default: 5 */
  maxRetries?: number;
  /** Minimum tool calls before agent can conclude. Default: undefined (no minimum) */
  minToolCalls?: number;
  /** Called when a tool begins execution. Used for real-time WS visibility. */
  onToolCall?: (toolName: string, input: Record<string, unknown>) => void;
  /** Static portion of system prompt (cached via prompt caching). If set, systemPrompt becomes dynamic-only. */
  staticSystemPrompt?: string;
  /** Mastra Memory config for conversation persistence */
  memory?: {
    thread: { id: string; metadata?: Record<string, unknown> };
    resource: string;
  };
  /**
   * Optional per-run tool-call tracker. When set, the runner registers every
   * tool call and wraps outputs with a `[toolCallId=...]` header so the agent
   * can cite the exact call via `cite_evidence`. Typed structurally to keep
   * the port free of infrastructure imports — the concrete ToolCallTracker
   * in `shared/infra/llm/tool-call-tracker.ts` satisfies this shape.
   */
  toolCallTracker?: ToolCallTrackerPort;

  /**
   * Optional per-run trace context for observability (OTel-Langfuse correlation).
   * Merged with any construction-time traceContext on ObservedAgentRunner.
   */
  traceContext?: {
    sessionId?: string;
    userId?: string;
  };
}

/** Structural contract of a per-run tool-call tracker. */
export interface TrackedToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output: string;
}

export interface ToolCallTrackerPort {
  register(name: string, input: Record<string, unknown>, output: string): string;
  lookup(id: string): TrackedToolCall | undefined;
  all(): TrackedToolCall[];
}
export interface ToolCallRecord {
  /** Deterministic id assigned at execution time; citable via cite_evidence. */
  id?: string;
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
    cacheReadInputTokens?: number;
    cacheCreationInputTokens?: number;
  };
  turns: number;
  model: string;
  costUsd: number;
  /** Number of tool results that were truncated */
  truncatedResults?: number;
  /** Number of tool batches that ran in parallel */
  parallelBatches?: number;
  /** Number of API retries due to transient errors */
  retryCount?: number;
}
export interface AgentRunner {
  run(config: AgentRunConfig): Promise<AgentRunResult>;
}

# 07 — AI System (Agents, Models, Tools)

[< Back to index](./00-index.md) | [Previous: API Endpoints](./06-api-endpoints.md) | [Next: Security >](./08-security.md)

---

## How AI Works in CauseFlow

CauseFlow uses the Claude API (Anthropic) to run **specialized AI agents** against real tenant infrastructure. Each agent has:

- A specific **model** (Haiku, Sonnet) chosen by role
- A **static system prompt** (role definition — cached) plus a **dynamic system prompt** (per-incident context)
- **Tools** assembled dynamically based on what the tenant has connected
- **Temporary credentials** (AWS STS, GitHub App tokens, Composio auth tokens, Relay session tokens)
- **Observability**: every run is wrapped by `ObservedAgentRunner` and traced to Langfuse

There are **two orchestration modes** (feature-flagged) and a chat-side **intent classifier** that decides when to even invoke agents. Both are covered below.

---

## Models in Use

| Model | Default Used For |
|-------|------------------|
| **claude-haiku-4-5** | `scout`, `log_analyst`, `metric_analyst`, `change_detector`, `code_analyzer`, `issue_correlator`, `notification_sender`, knowledge metadata extraction |
| **claude-sonnet-4-6** | `infra_inspector`, `db_analyst`, `code_fixer`, `apm_analyst`, `orchestrator`, `diagnosis_verifier`, synthesis, triage, **intent classification** |

Models are configurable via env vars (`ANTHROPIC_*_MODEL`) and resolved from `config.anthropic.agentModels`. There is intentionally no Opus in the default pipeline — Sonnet handles synthesis and verification, and Haiku handles scanning-heavy work.

All model IDs were migrated from pinned versions (`claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`) to the latest aliases (`claude-sonnet-4-6`, `claude-haiku-4-5`). Same pricing, better models — no config change needed beyond updating any hardcoded env overrides.

> **Note on cost:** the numbers in the "Cost per Investigation" section at the bottom are approximate and come from older Promptfoo runs. They should be treated as order-of-magnitude estimates until a fresh measurement is taken after the Scout + Verifier + PTC changes landed. Cost math itself is now centralized in `src/shared/domain/cost.ts` (`calculateCost()`) — a single source of truth consumed by every runner.

---

## Agent Inventory (Wave-Based Mode)

Agents are grouped into **waves**. Each wave runs in parallel internally; later waves receive the findings of earlier waves as context. Source of truth: `src/modules/investigation/application/agent-configs.ts` (`AGENT_CONFIG_MAP`).

### Wave 0 — Scout (fast context gathering)

```
Agent: scout
Model: claude-haiku-4-5
Max turns: 3   (hard cap — scout must be fast)
Min tool calls: 2
Tools: get_incident_details, MEMORY_TOOLS (recall_past_incidents,
       get_service_topology, ...), GITHUB_TOOLS
Goal:  Gather initial context — timeline, suspects, related past
       incidents, recent deploys, service health — as a structured
       JSON brief, NOT a diagnosis.
```

Scout output is prepended to the memory context passed to Wave 1 and Wave 2, so downstream specialists start with a warm cache of what is likely going on. Enabled by `ENHANCED_RUNNER_SCOUT_AGENT`.

### Wave 1 — Foundational Specialists

```
log_analyst      — Haiku, maxTurns 5, min 2 tool calls
metric_analyst   — Haiku, maxTurns 5, min 2 tool calls
```

Both query CloudWatch Logs and CloudWatch Metrics via the single generic `aws_api_call(service, operation, params)` tool. They build a timeline, identify anomalies, and output `## Summary` with a confidence level.

### Wave 2 — Deep Specialists + Composio-Backed Agents

```
infra_inspector    — Sonnet, maxTurns 8, PTC-enabled (code_execution)
change_detector    — Haiku,  maxTurns 8, PTC-enabled (code_execution)
code_analyzer      — Haiku   (GitHub/CodeCommit read)
db_analyst         — Sonnet  (Relay-gated — auto-added when Relay connected)

# Composio-backed (tools merged at runtime from tenant connections)
issue_correlator   — Haiku   (Jira/Linear/Shortcut/Trello/ClickUp/Asana)
apm_analyst        — Sonnet  (Datadog/Sentry/New Relic)
notification_sender — Haiku  (Slack/Teams/Discord)
```

Wave 2 receives Wave 1's formatted findings in its prompt ("confirm, refute, or build upon them"). `code_analyzer` is auto-added when the tenant has the GitHub App installed; `db_analyst` is auto-added when a Relay session is connected.

### Wave 3 — Diagnosis Verifier (adversarial review)

```
Agent: diagnosis_verifier
Model: claude-sonnet-4-6
Max turns: 5
Min tool calls: 2   (a verification without tool evidence is rejected)
Tools: LOG_TOOLS + METRIC_TOOLS + GITHUB_TOOLS + get_incident_details
Goal:  Challenge the synthesized root cause. Search for CONTRADICTORY
       evidence, propose at least one alternative hypothesis, rate
       confidence HIGH/MEDIUM/LOW, recommend ACCEPT/REVISE/REJECT.
```

Runs AFTER synthesis, before the incident is closed. Findings are stored as an evidence record (`agentRole: 'diagnosis_verifier'`) and appended to the investigation result with a `[Verification]` tag. Enabled by `ENHANCED_RUNNER_VERIFICATION_AGENT`. When the flag is off, the use-case falls back to a Hindsight `reflect()`-based falsification check.

### Post-Synthesis — Code Fixer

```
Agent: code_fixer
Model: Sonnet
When:  Only if code_analyzer ran and found relevant code
Tools: get_file_contents, create_pull_request
Output: draft PR attached to the incident's proposedFix and
        create_fix_pr recommended action
```

---

## Agent Inventory (Orchestrator Mode — Alternative)

Wave-based investigation is the default, but CauseFlow also ships a **single-agent orchestrator mode**, gated by `ORCHESTRATOR_MODE_ENABLED`. In this mode one Sonnet agent is given the union of all available tools and a five-phase SRE methodology prompt:

```
Agent: orchestrator
Model: claude-sonnet-4-6
Max turns: 20
Min tool calls: 8
Phases (from ORCHESTRATOR_SYSTEM_PROMPT):
  1. TRIAGE   — incident details, past incidents, topology
  2. DISCOVER — ECS / CloudWatch / SQS / ALB / Lambda / CodeCommit
  3. DEEPEN   — follow clues (DLQ messages, error logs, diffs)
  4. CORRELATE — build timeline, verify counter-examples, remember_finding
  5. CONCLUDE — root cause, evidence, recommended actions, confidence
```

The orchestrator's tool set is assembled by `buildToolsForAgent(..., 'orchestrator')` in `investigate-incident.usecase.ts`: it starts from `ORCHESTRATOR_TOOLS` and conditionally adds `aws_api_call`, `CODE_ANALYZER_TOOLS`, `DB_TOOLS`, and any Composio tools the tenant has connected. When `orchestratorMode` is on, the use-case short-circuits the wave pipeline and calls `executeOrchestrator()` directly.

**When to pick which mode:**

- **Wave-based** — better parallelism, cheaper per incident (specialists are mostly Haiku), clean evidence attribution per agent, easier to debug in Langfuse.
- **Orchestrator** — fewer round-trips, the model keeps all context in one conversation (helps with multi-hop causal reasoning), simpler operationally. More expensive per turn, longer tail latency.

Both modes are currently supported; pick per-tenant via config.

---

## Dynamic Tools Per Tenant

Every tenant has a different set of integrations. Sending `query_jira_ticket` to a tenant that has no Jira account wastes tokens and invites hallucinations. CauseFlow solves this by assembling the tool list **at request time** based on real tenant capabilities.

The flow (`investigate-incident.usecase.ts`):

1. **`buildTenantCapabilities(tenantId)`** queries three sources:
   - `credentialVendor.vend(...)` — does STS return real AWS keys? If yes, `hasAws = true`.
   - `integrationToolProvider.getConnectionStatus(tenantId)` — returns the list of connected Composio apps (`github`, `slack`, `datadog`, `jira`, `notion`, `sentry`, ...).
   - `relayGateway.isConnected(tenantId)` — is there a live Relay WebSocket session for DB access?
2. **`buildToolsForAgent(agentConfig, capabilities, composioTools)`** starts from the agent's static tool list and:
   - Adds `aws_api_call` only when `hasAws` is true.
   - Adds Composio tools (already filtered by what the tenant has connected).
   - Adds `DB_TOOLS` only for `db_analyst` and only when Relay is connected.
   - For the orchestrator, merges `CODE_ANALYZER_TOOLS` when a code-knowledge repo is configured.
3. **`buildCapabilitiesPrompt(...)`** produces a human-readable "Available infrastructure access:" block that is appended to the agent's dynamic system prompt, so the model *knows* which integrations are actually reachable and stops guessing.

Composio meta-tools (management/admin tools surfaced by Composio itself) are filtered out before the list is handed to the agent — see commit `259987d`.

Net effect: a tenant with only AWS + Slack gets a strictly smaller tool list than one with AWS + GitHub + Sentry + Datadog + Jira. Prompts, tools, and token cost all scale to real connectivity.

---

## Intent Classification (Chat / Memory Module)

Not every chat message deserves a full investigation. The memory module's `ChatUseCase` (`src/modules/memory/application/chat.usecase.ts`) first routes the message through a **Sonnet-based intent classifier** before deciding what to do.

```
Classifier model: claude-sonnet-4-6
System prompt:    ROUTER_PROMPT (JSON-only output)
Max tokens:       200
Temperature:      0
```

Five intents are recognized:

| Intent | Meaning | Handler |
|--------|---------|---------|
| `general` | Greetings, "what do you do?" | Static response, no LLM |
| `memory_only` | Question answerable from history (past incidents, architecture) | `agentMemory.reflect()` — sync, no tool calls |
| `knowledge` | **Declarative** facts about the tenant's system ("our code is in CodeCommit repo X") | `handleKnowledge` — extracts tags via Haiku, retains in Hindsight |
| `live_check` | "Any errors right now?", "Is the deploy healthy?" | Async dispatch: runs an on-demand agent with `LOG_TOOLS + METRIC_TOOLS + MEMORY_TOOLS`, streams the result via SSE |
| `incident` | Something is broken and needs a full investigation | Reserves an investigation credit, creates an incident, publishes `incident.created`, enqueues for triage |

**Heuristic fallbacks were removed** in commit `b2c1f2a`. If the Sonnet classifier fails (JSON parse error, API error), the message is defaulted to `memory_only` — the safest, cheapest intent — and logged. This change fixed the long-standing bug where ambiguous questions were misrouted to `knowledge` (see commit `01ed111`).

The classifier also extracts `service`, `timeWindow`, and (for incidents) a short `title` in the same call, so no second LLM hop is needed before dispatching.

The `live_check` handler's `LIVE_CHECK_PROMPT` was updated to drop references to the long-removed `query_logs` / `query_metrics` tools — it now instructs the model to use `aws_api_call` directly with explicit `(service, action)` pairs (`logs/FilterLogEvents`, `cloudwatch/GetMetricData`, `ecs/DescribeServices`, `sqs/GetQueueAttributes`), matching the rest of the platform's "one generic AWS tool" model.

---

## Programmatic Tool Calling (PTC)

The investigation worker no longer uses a hand-rolled `while (tool_use)` loop. It uses **`EnhancedPTCRunner`** (`src/shared/infra/llm/enhanced-ptc-runner.ts`), which builds on `AnthropicPTCAgentRunner` and adds:

- **`code_execution_20250522` server tool** (feature-flagged via `ENABLE_PROGRAMMATIC_TOOL_CALLING`). When enabled for agents marked `useCodeExecution: true` (currently `infra_inspector` and `change_detector`), Claude can write code that calls our client tools in a sandboxed container — allowing parallel/batched tool use and local post-processing of raw AWS responses without round-tripping through the model.
- **Container reuse across turns** via `containerId` tracking.
- **Static/dynamic prompt split** with `cache_control: { type: 'ephemeral' }` on the static system prompt, so the large role-definition prompt (methodology, tool rules, output format) is cached across the run instead of re-charged per turn.
- **Parallel tool batching, truncation counters, and retry counters** — all exposed as span attributes (`parallelBatches`, `truncatedResults`, `retryCount`, `cacheReadTokens`, `cacheCreationTokens`).

The legacy `AnthropicAgentRunner` remains as a fallback, selectable via feature flag.

### MastraAgentRunner (Phase 1)

A second runner — `MastraAgentRunner` (`src/shared/infra/llm/mastra-agent-runner.ts`) — ships as a **drop-in replacement** for `EnhancedPTCRunner`, gated behind `config.enhancedRunner.mastra` (env var `MASTRA_ENABLED`, default `false`). PTC remains the default in production; Mastra is Phase 1 of an incremental migration to the Mastra agent framework.

How it works:

- Implements the same `AgentRunner` port, so the investigation worker swaps it in via a single conditional in `src/workers/investigation-worker.ts`:
  ```ts
  const rawAgentRunner = config.enhancedRunner.mastra
      ? new MastraAgentRunner()
      : new EnhancedPTCRunner();
  ```
- Uses Mastra's `Agent.generate()` under the hood with the Anthropic provider (`anthropic/claude-sonnet-4-6` by default), via a `getMastra()` singleton that initializes the framework once per process.
- Existing CauseFlow tools work unchanged via **`mastra-tool-adapter.ts`** (`src/shared/infra/llm/mastra-tool-adapter.ts`), which converts `ToolDefinition[] + toolHandler` into Mastra's `createTool()` objects. The adapter translates JSON Schema → Zod, preserves per-tool `maxResultChars` truncation, and keeps the `ToolCallRecord[]` log the rest of the system expects.
- **Feature parity** with the PTC runner:
  - Tool result truncation (`maxResultChars`, tracked via `getTruncatedCount()`).
  - `minToolCalls` enforcement via a nudge loop — if the agent stops below the minimum, it is re-prompted to continue investigating instead of failing silently.
  - Cost estimation from token usage, computed by the centralized `calculateCost()` in `src/shared/domain/cost.ts`.
- **Prompt caching** via `promptCacheMiddleware` — a Vercel AI SDK `LanguageModelMiddleware` that runs in `transformParams` and attaches `cacheControl: { type: 'ephemeral' }` to (a) the last system message and (b) the most recent user/assistant message in the conversation. Mastra forwards these as Anthropic's standard `cache_control` markers, giving the same ~90% input cost reduction on cached turns as the PTC runner.
- **Input token limiting** via `TokenLimiterProcessor({ limit: 200_000 })` — an Anthropic-native input processor that trims the conversation to stay under 200k input tokens before each call.
- **Native context management** via `providerOptions.anthropic.contextManagement.edits`:
  - `compact_20260112` kicks in at 150k tokens — summarizes and compresses old conversation turns
  - `clear_tool_uses_20250919` kicks in at 100k tokens (keeping last 10 tool-call pairs) — drops redundant tool results from deep context
- **Mastra Memory** (`@mastra/memory` backed by `@mastra/dynamodb`): when an `AgentRunConfig.memory` field is provided, the runner attaches a per-investigation memory store using:
  - Table: `{DYNAMODB_TABLE_NAME}-memory` (e.g. `causeflow-staging-memory`)
  - Thread ID: `investigation-{incidentId}`, Resource ID: `tenantId`
  - 40 last messages retained, `semanticRecall: false`
  - Working memory template tracks: current phase, confidence level, primary hypothesis, key findings, open questions, corrections from prior incidents
  - 90-day TTL on messages and thread records
- **Langfuse observability** via `@mastra/langfuse`: when `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are set, a `LangfuseExporter` is wired into the Mastra `Observability` singleton and all agent traces are forwarded to Langfuse automatically. `langfuseExporter.flush()` is called before the Fargate worker process exits to ensure all spans are delivered.
- **Single source of truth for cost:** `MODEL_PRICING` in `cost.ts` is the only place pricing lives — the runner never duplicates the table locally.

What Mastra does **not** give you (today): no `code_execution` server tool, no container reuse, no parallel tool batching instrumentation. Agents that rely on PTC code execution (`infra_inspector`, `change_detector`) therefore still benefit from running on `EnhancedPTCRunner` — which is why Mastra is behind a flag and PTC remains the default.

**EnhancedPTCRunner vs MastraAgentRunner — feature matrix:**

| Feature | EnhancedPTCRunner | MastraAgentRunner |
|---------|-------------------|-------------------|
| `code_execution` server tool | Yes (gated) | No |
| Container reuse across turns | Yes | No |
| Parallel tool batch instrumentation | Yes | No |
| Prompt caching | Static prompt block via `cache_control` | `promptCacheMiddleware` (last system + recent msg) |
| Input token cap | None explicit | `TokenLimiterProcessor` (200k) |
| Native context management | No | `compact` at 150k + `clear_tool_uses` at 100k |
| DynamoDB investigation memory | No | Yes (`@mastra/memory` + `@mastra/dynamodb`) |
| Langfuse tracing | Via `ObservedAgentRunner` wrapper | Native via `@mastra/langfuse` exporter |
| `minToolCalls` nudge loop | Yes | Yes |
| Tool result truncation | Yes | Yes (`mastra-tool-adapter.ts`) |
| Cost calculation | `calculateCost()` in `cost.ts` | `calculateCost()` in `cost.ts` |

### Prompt caching

Every `SubAgentConfig` has two fields: `staticSystemPrompt` (cached) and `systemPrompt` (rebuilt per incident with title, severity, memory context, repo context, capabilities block). The static portion — which is the bulk of the tokens — is marked with Anthropic's `cache_control` marker so it hits the ephemeral prompt cache.

Both runners implement this:

- **`EnhancedPTCRunner`** — marks the static system prompt block directly on the Anthropic Messages API request with `cache_control: { type: 'ephemeral' }`.
- **`MastraAgentRunner`** — uses `promptCacheMiddleware`, a Vercel AI SDK `LanguageModelMiddleware` registered on the Mastra `Agent`. It runs in `transformParams` and attaches `cacheControl: { type: 'ephemeral' }` to the last system message and the most recent user/assistant message. Mastra's Anthropic provider emits these as standard `cache_control` markers on the wire.

Observed cache hit tokens show up in Langfuse as `cacheReadTokens` and in metrics as `agent.cache_read_tokens`.

---

## Knowledge Feedback Loop

After an investigation closes, the user can mark it `investigation_accurate`, `investigation_inaccurate`, or `investigation_partial` (`RecordInvestigationFeedbackUseCase`). Feedback feeds back into the system in two ways:

1. **Hindsight memory** — feedback is retained with tags `['feedback', 'incident:<id>', 'verdict:positive|negative']`, and is surfaced in future `agentMemory.recall()` calls for similar incidents. Future investigations thus see "the last time we blamed X for this symptom, it was wrong."
2. **Runbook Registry confirmations** — when positive feedback arrives and the investigation has a `rootCauseHash`, the matching runbook entry's `confirmations` counter is incremented. Repeated positive confirmations drive a Bayesian-style belief update: runbooks that have been confirmed many times can trigger the "known solution" fast-path in `investigate-incident.usecase.ts` (pre-investigation memory check with a 0.85 confidence threshold), skipping the full agent pipeline entirely.

Per-agent feedback (`agentFeedback: [{ agentRole, quality: 1..5 }]`) is also retained, giving us per-role quality signal over time.

---

## Observability — Langfuse Tracing

Every agent run is wrapped by **`ObservedAgentRunner`** (`src/shared/infra/llm/observed-agent-runner.ts`), and every raw LLM call is wrapped by **`ObservedAnthropicClient`**. Both are instantiated in `src/workers/investigation-worker.ts` with a trace context built from the incident:

```ts
const traceContext = { sessionId: INCIDENT_ID, userId: TENANT_ID };
const agentRunner  = new ObservedAgentRunner(rawRunner, tracer, metrics, traceContext);
const llmClient    = new ObservedAnthropicClient(rawLlm,   tracer, metrics, traceContext);
```

- `sessionId = incidentId` — all spans for one investigation group under a single Langfuse session. Replaying an investigation is one click.
- `userId = tenantId` — usage, cost, and error rates can be sliced per tenant in the Langfuse dashboard.

### Span attributes captured per agent run

```
agent.run span:
  model, maxTurns, toolCount, minToolCalls, hasStaticPrompt
  turns, toolCalls, latencyMs
  inputTokens, outputTokens
  cacheReadTokens, cacheCreationTokens        (PTC prompt cache)
  truncatedResults, parallelBatches, retryCount   (PTC-enhanced)
  input  = { systemPrompt (static excerpt + dynamic), userPrompt, tools, model }
  output = { response, toolCalls[{name,input,output[:500]}], turns }
  status = ok | error
```

The same data is also emitted as OpenTelemetry-style metrics:

```
agent.runs (counter)         agent.latency_ms (histogram)
agent.turns (gauge)          agent.tool_calls (counter)
agent.input_tokens (counter) agent.output_tokens (counter)
agent.cost_usd (histogram)   agent.errors (counter)
agent.cache_read_tokens, agent.cache_creation_tokens
agent.truncated_results, agent.parallel_batches, agent.retries
```

An example Langfuse trace for one incident:

```
session = inc_xyz789  (userId = tenant_acme)
├── agent.run · scout              · haiku   · 3 turns · 4 tool calls
├── agent.run · log_analyst        · haiku   · 4 turns · 6 tool calls
├── agent.run · metric_analyst     · haiku   · 3 turns · 5 tool calls
├── agent.run · infra_inspector    · sonnet  · 6 turns · 9 tool calls (PTC)
├── agent.run · change_detector    · haiku   · 5 turns · 7 tool calls (PTC)
├── llm.complete · synthesis       · sonnet  · input 5k / output 800
└── agent.run · diagnosis_verifier · sonnet  · 4 turns · 3 tool calls
```

---

## AI Quality Testing (Promptfoo)

CauseFlow uses Promptfoo to prevent prompt regressions:

```
tests/eval/promptfoo/

Scenarios:
- "OOM alert in ECS → triage classifies as critical"
- "Generic warning → NOT classified as critical"
- "log_analyst finds OutOfMemoryError in the logs"
- "Synthesis mentions memory leak when all agents indicate OOM"

How to run:
  pnpm eval:triage      # triage quality
  pnpm eval:pipeline    # end-to-end pipeline
```

---

## Cost per Investigation

> **Caveat:** the numbers below were measured before the Scout + Diagnosis Verifier waves and PTC prompt caching shipped. Directionally correct, absolute numbers stale. A fresh Promptfoo run is needed to update them.

Average variable cost: **~$0.70** per investigation in Anthropic tokens.

**Rough breakdown:**

```
Wave 0 (scout, Haiku):              ~$0.01–0.03
Wave 1 (2x Haiku specialists):      ~$0.10–0.15
Wave 2 (Sonnet + Haiku + Composio): ~$0.15–0.25
Synthesis (Sonnet):                 ~$0.10–0.20   (was Opus at ~$0.30–0.40)
Wave 3 (diagnosis_verifier, Sonnet): ~$0.05–0.10
────────────────────────────────────────────────
Total AI cost:                      ~$0.70 per investigation (avg)
```

Prompt caching on the static system prompts (ephemeral cache, PTC runner) reduces input token cost on repeated turns within one run — factored into the range above.

**Cost varies by investigation complexity:**

| Scenario | Cost | When |
|----------|------|------|
| Simple (P10)  | $0.30–0.50 | Scout catches it, few Wave 1 calls, fast synthesis |
| Average (P50) | **$0.70**  | Typical test scenario |
| Complex (P75) | $1.00–1.20 | All agents, many tool calls, verifier goes deep |
| Worst case (P90) | $1.50–2.00 | Max turns on every wave, large synthesis context |

### Monthly Costs by Plan (at average cost)

| Plan | Investigations/mo | Events/mo | AI Cost/mo | Monthly Price | Net |
|------|-------------------|-----------|------------|---------------|-----|
| Starter    | 15  | 500    | $10.50 + $10.00 = **$20.50**  | $99   | **+$78.50**  |
| Pro        | 60  | 3,000  | $42.00 + $60.00 = **$102.00** | $349  | **+$247.00** |
| Business   | 200 | 10,000 | $140.00 + $200.00 = **$340.00** | $899  | **+$559.00** |
| Enterprise | Custom | Custom | — | Custom (min $2,000) | Negotiated |

**Note:** These are Claude API costs only. Shared infrastructure (DynamoDB, SQS, Redis, ECS, Langfuse self-hosted) runs ~$150/month total — not per tenant.

[Next: Security >](./08-security.md)

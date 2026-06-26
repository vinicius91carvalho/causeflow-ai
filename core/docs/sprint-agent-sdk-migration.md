# Sprint — Migração para Claude Agent SDK

## Decisão: Raw SDK > Agent SDK (Sprint 8)

Após avaliação detalhada do **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`), decidimos **NÃO migrar** e, em vez disso, hardening a implementação existente com `@anthropic-ai/sdk@0.74.0`.

### Motivos

| Critério | Agent SDK | Raw SDK (escolhido) |
|---|---|---|
| Runtime | Requer Claude Code CLI como subprocess | Node.js puro — roda em qualquer container |
| Use case | Otimizado para coding tasks interativas | Flexível para qualquer workflow server-side |
| Overhead | CLI + sandbox + filesystem layers | API calls diretas, mínimo overhead |
| ECS/Container fit | Precisa de TTY, disco, CLI instalado | Zero dependências além do SDK |
| Control | Abstrações opacas (hooks, sessions) | Controle total do loop e estado |

### O que fizemos (Sprint 8)

Em vez de migrar para o Agent SDK, melhoramos a implementação raw SDK:

1. **`toolRunner` automático** — Substituiu 60 linhas de while loop manual por `client.beta.messages.toolRunner()` com `max_iterations`
2. **Structured output via `tool_choice`** — Substituiu regex `match(/\{[\s\S]*\}/)` por `tool_choice: { type: 'tool', name: 'structured_output' }`
3. **Model-per-agent** — Cada sub-agent agora tem modelo configurável (haiku para volume, sonnet para complexidade)
4. **Cost tracking** — `calculateCost()` com pricing por modelo, `costUsd` em todos os results
5. **Zod schemas nas tools** — Validação type-safe de input com `zodToJsonSchema` em vez de JSON Schema manual
6. **`betaZodTool`** pronto para uso — SDK helpers disponíveis para tools com Zod quando necessário

### Features do Agent SDK que NÃO precisamos (agora)

- **Resumable sessions**: Investigações completam em < 60s, sem necessidade de resume
- **MCP servers**: Nossos tools já são in-process via ports
- **Hooks**: Audit trail já é feito via EventBus subscriptions
- **Todo tracking**: Não temos UI interativa de progresso
- **Skills/SKILL.md**: Nossos agents são programáticos, não filesystem-based

### Quando reconsiderar

- Se precisarmos de agents interativos com UI (chat)
- Se investigações passarem a durar > 5 min (session resumption)
- Se precisarmos de sandbox isolation entre agents
- Se o Agent SDK ganhar suporte headless sem CLI dependency

---

## Contexto (Plano Original)

O módulo de investigation atualmente usa uma implementação **manual** do loop agentic (`tool_use`) via `@anthropic-ai/sdk`. Os 4 sub-agents (log_analyst, metric_analyst, infra_inspector, change_detector) são despachados em paralelo com tools especializadas, mas sem isolamento de contexto real, sem model-per-agent, e sem sessions resumíveis.

O **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) oferece essas features nativamente via `query()` + `AgentDefinition`, além de MCP servers, custom tools, hooks, structured outputs, cost tracking e deployment patterns para produção.

**Referências**:
- [Sub-agents](https://platform.claude.com/docs/en/agent-sdk/subagents)
- [TypeScript Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [MCP Integration](https://platform.claude.com/docs/en/agent-sdk/mcp)
- [Custom Tools](https://platform.claude.com/docs/en/agent-sdk/custom-tools)
- [Hooks](https://platform.claude.com/docs/en/agent-sdk/hooks)
- [Structured Outputs](https://platform.claude.com/docs/en/agent-sdk/structured-outputs)
- [Cost Tracking](https://platform.claude.com/docs/en/agent-sdk/cost-tracking)
- [Todo Tracking](https://platform.claude.com/docs/en/agent-sdk/todo-tracking)
- [Hosting](https://platform.claude.com/docs/en/agent-sdk/hosting)
- [Skills](https://platform.claude.com/docs/en/agent-sdk/skills)

---

## Estado Atual vs Alvo

| Aspecto | Atual (`@anthropic-ai/sdk`) | Alvo (`@anthropic-ai/claude-agent-sdk`) |
|---|---|---|
| Package | `@anthropic-ai/sdk@0.74.0` | `@anthropic-ai/claude-agent-sdk` |
| Agentic loop | Manual em `AnthropicAgentRunner` | Built-in via `query()` |
| Sub-agents | Custom dispatch em `InvestigateIncidentUseCase` | `AgentDefinition` com `agents: {}` |
| Context isolation | Nenhum | Cada sub-agent tem contexto isolado |
| Tool restrictions | Manual (config por agent) | Declarativo `tools: ["Read", "Grep"]` |
| Model per agent | Todos usam `investigationModel` | `model: 'haiku'` / `'sonnet'` / `'opus'` |
| Resumable sessions | Não suportado | `resume: sessionId` |
| Token tracking | Manual (acumulador) | Built-in `total_cost_usd` + `modelUsage` |
| Error handling | `Promise.allSettled` | SDK-level retry/fallback + hooks |
| MCP servers | Não suportado | `mcpServers: {}` (stdio, sse, http, in-process) |
| Custom tools | Manual tool_use handlers | `tool()` helper + Zod schemas |
| Hooks | Não suportado | 12 hook events (PreToolUse, PostToolUse, etc.) |
| Structured output | JSON.parse manual | `outputFormat` com JSON Schema/Zod |
| Sandbox | Não suportado | Programmatic sandbox config |

---

## Feature: Sub-Agents (`AgentDefinition`)

O recurso central. Permite definir agents programaticamente com contexto isolado.

```typescript
type AgentDefinition = {
  description: string;     // Quando usar este agent (NL)
  tools?: string[];        // Tools permitidas (herda todas se omitido)
  prompt: string;          // System prompt do agent
  model?: "sonnet" | "opus" | "haiku" | "inherit";
}
```

### Uso no CauseFlow

```typescript
const result = query({
  prompt: `Investigate incident ${incidentId}`,
  options: {
    agents: {
      log_analyst: {
        description: "Analyzes application and infrastructure logs",
        tools: ["Bash", "Grep", "Read"],
        prompt: "You are a log analysis specialist...",
        model: "haiku"  // Volume alto, modelo barato
      },
      metric_analyst: {
        description: "Analyzes metrics and detects anomalies",
        tools: ["Bash", "Read"],
        prompt: "You are a metrics specialist...",
        model: "haiku"
      },
      infra_inspector: {
        description: "Inspects cloud infrastructure state",
        tools: ["Bash", "Read"],
        prompt: "You are an infrastructure specialist...",
        model: "sonnet"
      },
      change_detector: {
        description: "Detects recent changes that may have caused the incident",
        tools: ["Bash", "Grep", "Read"],
        prompt: "You are a change detection specialist...",
        model: "haiku"
      }
    },
    maxTurns: 20,
    model: "sonnet"  // Orchestrator usa sonnet
  }
});
```

---

## Feature: MCP Servers

O Agent SDK suporta 4 tipos de MCP servers:

### 1. Stdio (processo externo)
```typescript
mcpServers: {
  "cloud-tools": {
    type: "stdio",
    command: "node",
    args: ["./mcp-servers/cloud-tools.js"],
    env: { AWS_REGION: "sa-east-1" }
  }
}
```

### 2. SSE (Server-Sent Events)
```typescript
mcpServers: {
  "monitoring": {
    type: "sse",
    url: "https://monitoring.internal/mcp",
    headers: { Authorization: "Bearer ..." }
  }
}
```

### 3. HTTP (Streamable HTTP)
```typescript
mcpServers: {
  "alerting": {
    type: "http",
    url: "https://alerts.internal/mcp",
    headers: { "X-API-Key": "..." }
  }
}
```

### 4. In-Process SDK Server (`createSdkMcpServer`)
```typescript
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const causeflowTools = createSdkMcpServer({
  name: "causeflow-tools",
  version: "1.0.0",
  tools: [
    tool("query_logs", "Query application logs", {
      service: z.string(),
      timeRange: z.string(),
      filter: z.string().optional()
    }, async (args) => {
      const logs = await cloudProvider.queryLogs(/* ... */);
      return { content: [{ type: "text", text: JSON.stringify(logs) }] };
    }),

    tool("query_metrics", "Query infrastructure metrics", {
      metricName: z.string(),
      period: z.number()
    }, async (args) => {
      const metrics = await cloudProvider.queryMetrics(/* ... */);
      return { content: [{ type: "text", text: JSON.stringify(metrics) }] };
    }),

    tool("describe_service", "Get service infrastructure details", {
      serviceId: z.string()
    }, async (args) => {
      const info = await cloudProvider.describeService(/* ... */);
      return { content: [{ type: "text", text: JSON.stringify(info) }] };
    })
  ]
});

// Uso:
query({
  prompt: "...",
  options: {
    mcpServers: { "causeflow-tools": causeflowTools }
  }
});
```

### Aplicação no CauseFlow

O in-process MCP server é o mais relevante para nós. Podemos expor os ports existentes como tools MCP:

| Tool MCP | Port usado | Descrição |
|---|---|---|
| `query_logs` | `CloudProvider.queryLogs()` | Consulta logs de aplicação |
| `query_metrics` | `CloudProvider.queryMetrics()` | Consulta métricas |
| `describe_service` | `CloudProvider.describeService()` | Info de infra |
| `execute_action` | `CloudProvider.executeAction()` | Executar remediação |
| `search_incidents` | `IIncidentRepository` | Buscar incidentes passados |
| `get_runbook` | `IKnowledgeRepository` (futuro) | Buscar runbooks |

---

## Feature: Custom Tools (`tool()` helper)

Permite criar tools type-safe com Zod schemas, sem precisar de MCP server externo.

```typescript
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const queryLogsToolDef = tool(
  "query_logs",
  "Query application logs from CloudWatch/Datadog",
  {
    service: z.string().describe("Service name"),
    timeRange: z.string().describe("Time range (e.g., '1h', '30m')"),
    filter: z.string().optional().describe("Log filter expression"),
    severity: z.enum(["info", "warn", "error", "fatal"]).optional()
  },
  async (args) => {
    const logs = await cloudProvider.queryLogs(/* map args */);
    return {
      content: [{ type: "text", text: JSON.stringify(logs, null, 2) }]
    };
  }
);
```

As tools são agrupadas em um `createSdkMcpServer()` e passadas via `mcpServers` na config.

---

## Feature: Hooks

Sistema de interceptação com 12 eventos. Fundamental para segurança, auditoria e controle.

### Eventos Disponíveis

| Hook Event | Descrição | Uso no CauseFlow |
|---|---|---|
| `PreToolUse` | Antes de executar tool (pode bloquear/modificar) | Validar comandos perigosos, audit trail |
| `PostToolUse` | Após execução de tool | Log de todas as ações, métricas |
| `PostToolUseFailure` | Falha na execução de tool | Error tracking, alertas |
| `UserPromptSubmit` | Prompt do usuário submetido | Injetar contexto (tenant, incident) |
| `Stop` | Agent para execução | Cleanup, salvar estado |
| `SubagentStart` | Sub-agent iniciado | Tracking de sub-agents paralelos |
| `SubagentStop` | Sub-agent completou | Agregar resultados |
| `PreCompact` | Antes de compactação de contexto | Salvar transcript completo |
| `PermissionRequest` | Solicitação de permissão | Custom authorization |
| `SessionStart` | Sessão iniciada | Inicializar telemetria |
| `SessionEnd` | Sessão finalizada | Cleanup de recursos |
| `Notification` | Mensagem de status do agent | Enviar para Slack/PagerDuty |

### Exemplo: Audit Hook para Investigações

```typescript
import { HookCallback, PostToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";

const auditHook: HookCallback = async (input, toolUseID, { signal }) => {
  if (input.hook_event_name === "PostToolUse") {
    const postInput = input as PostToolUseHookInput;
    await auditUseCase.execute({
      tenantId,
      action: `agent.tool.${postInput.tool_name}`,
      resourceType: 'investigation',
      resourceId: incidentId,
      details: {
        tool: postInput.tool_name,
        input: postInput.tool_input,
        sessionId: input.session_id
      }
    });
  }
  return {};
};

const securityHook: HookCallback = async (input, toolUseID, { signal }) => {
  if (input.hook_event_name !== "PreToolUse") return {};
  const preInput = input as PreToolUseHookInput;

  // Bloquear comandos destrutivos
  if (preInput.tool_name === "Bash") {
    const cmd = preInput.tool_input.command as string;
    if (/rm\s+-rf|DROP\s+TABLE|DELETE\s+FROM/i.test(cmd)) {
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "Destructive command blocked by security policy"
        }
      };
    }
  }
  return {};
};
```

### Aplicação no CauseFlow

```typescript
query({
  prompt: "...",
  options: {
    hooks: {
      PreToolUse: [
        { matcher: "Bash", hooks: [securityHook] },       // Bloquear rm -rf
        { matcher: "Write|Edit", hooks: [readOnlyHook] },  // Agent = read-only
      ],
      PostToolUse: [
        { hooks: [auditHook] }                             // Audit trail completo
      ],
      SubagentStop: [
        { hooks: [subagentResultAggregator] }               // Agregar findings
      ],
      Notification: [
        { hooks: [slackNotifier] }                          // Status → Slack
      ]
    }
  }
});
```

---

## Feature: Structured Outputs

Forçar output do agent em formato JSON tipado. Elimina o `JSON.parse` manual.

```typescript
import { z } from "zod";

const InvestigationResultSchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low"]),
  rootCause: z.string(),
  affectedServices: z.array(z.string()),
  timeline: z.array(z.object({
    timestamp: z.string(),
    event: z.string(),
    source: z.string()
  })),
  recommendedActions: z.array(z.object({
    action: z.string(),
    params: z.record(z.unknown()),
    priority: z.number()
  })),
  confidence: z.number().min(0).max(1)
});

const result = query({
  prompt: "Investigate incident...",
  options: {
    outputFormat: {
      type: "json_schema",
      schema: zodToJsonSchema(InvestigationResultSchema)
    }
  }
});

// result.structured_output é tipado!
```

### Aplicação no CauseFlow

| Use Case | Schema | Benefício |
|---|---|---|
| Triage | `{ severity, category, confidence }` | Classificação estruturada |
| Investigation | `{ rootCause, timeline, recommendedActions }` | Output tipado para remediation |
| Remediation proposer | `{ steps[], description, riskLevel }` | Steps prontos para execução |

---

## Feature: Cost Tracking

Built-in no `SDKResultMessage`. Elimina o acumulador manual de tokens.

```typescript
for await (const message of query({ prompt: "...", options })) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(`Total cost: $${message.total_cost_usd}`);
    console.log(`Turns: ${message.num_turns}`);
    console.log(`Duration: ${message.duration_ms}ms`);

    // Per-model breakdown
    for (const [model, usage] of Object.entries(message.modelUsage)) {
      console.log(`  ${model}: $${usage.costUSD}`);
      console.log(`    Input: ${usage.inputTokens}, Output: ${usage.outputTokens}`);
      console.log(`    Cache read: ${usage.cacheReadInputTokens}`);
    }
  }
}
```

### Campos do `SDKResultMessage`

| Campo | Tipo | Descrição |
|---|---|---|
| `total_cost_usd` | `number` | Custo total em USD |
| `usage` | `NonNullableUsage` | Tokens agregados |
| `modelUsage` | `Record<string, ModelUsage>` | Breakdown por modelo |
| `num_turns` | `number` | Turnos de conversa |
| `duration_ms` | `number` | Duração total |
| `duration_api_ms` | `number` | Tempo em API calls |

### Aplicação no CauseFlow

- Logar custo por investigação → métricas de custo por tenant
- Comparar custo haiku vs sonnet para otimizar model assignment
- Alert se custo de uma investigação excede threshold
- Dashboard de custo/investigação para billing

---

## Feature: Todo Tracking

O agent gerencia tasks automaticamente via `TodoWrite` tool. Útil para tracking de progresso em investigações longas.

```typescript
for await (const message of query({ prompt: "...", options })) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "tool_use" && block.name === "TodoWrite") {
        const todos = block.input.todos;
        // { content: string, status: "pending"|"in_progress"|"completed", activeForm: string }
        todos.forEach((todo) => {
          // Report progress to Slack/dashboard
        });
      }
    }
  }
}
```

### Aplicação no CauseFlow

- **Investigation progress**: Mostrar progresso das análises no chat (Slack)
- **Remediation steps**: Tracking visual dos steps de remediação
- **Dashboard**: Progress bar para investigações em andamento

---

## Feature: Hosting & Deployment

O Agent SDK suporta deployment em containers com padrões para produção.

### Requisitos

- Node.js 18+
- Claude Code CLI: `npm install -g @anthropic-ai/claude-code`
- Recomendado: 1GiB RAM, 5GiB disk, 1 CPU
- Network: outbound HTTPS para `api.anthropic.com`

### Padrões de Deploy

| Padrão | Descrição | Fit para CauseFlow |
|---|---|---|
| **Ephemeral Sessions** | Container novo por task, destruído ao completar | Investigation one-shot |
| **Long-Running Sessions** | Container persistente, múltiplos agents | Agent monitor contínuo |
| **Hybrid Sessions** | Ephemeral com session resumption | Investigation que pode ser retomada |
| **Single Container** | Múltiplos agents no mesmo container | Simulation/testing |

### Nosso Cenário (ECS)

O CauseFlow roda em ECS. O padrão mais adequado é **Hybrid Sessions**:

1. SQS message chega → ECS task spawna container
2. Container executa `query()` com os sub-agents
3. Se investigação excede timeout → salva `session_id`
4. Próximo container pode `resume: sessionId` para continuar
5. Container destruído após investigação completa

### Sandbox Providers (alternativa ao ECS)

| Provider | Tipo |
|---|---|
| Modal Sandbox | Cloud sandbox |
| Cloudflare Sandboxes | Edge |
| E2B | Serverless sandbox |
| Fly Machines | Container |
| Vercel Sandbox | Serverless |

---

## Feature: Skills (`SKILL.md`)

Skills são agents definidos via filesystem. Alternativa ao `agents: {}` programático.

```
.claude/
  agents/
    log-analyst.md        # Descrição + prompt do agent
    metric-analyst.md
    infra-inspector.md
    change-detector.md
```

Cada `SKILL.md` contém instruções em natural language. O agent invoca automaticamente baseado no contexto.

### Decisão para o CauseFlow

Para nós, **`agents: {}` programático é melhor** que Skills por:
1. Agents são dinâmicos (config varia por tenant/incident type)
2. Tools são injetadas via ports (CloudProvider, etc.)
3. Skills filesystem-based são mais para CLI interactive use

Skills podem ser úteis para agents auxiliares (runbook search, documentation).

---

## Arquivos Impactados

### Ports (interfaces a refatorar)

| Arquivo | Mudança |
|---|---|
| `src/shared/application/ports/agent-runner.port.ts` | Adaptar interface para `query()` pattern |
| `src/shared/application/ports/llm-client.port.ts` | Pode ser absorvido pelo Agent SDK |

### Implementações a substituir

| Arquivo | Mudança |
|---|---|
| `src/shared/infra/llm/anthropic-agent-runner.ts` | Substituir loop manual por `query()` do Agent SDK |
| `src/shared/infra/llm/anthropic-client.ts` | Avaliar se `LLMClient` separado ainda é necessário |
| `src/modules/investigation/application/agent-configs.ts` | Converter `SubAgentConfig` → `AgentDefinition` |
| `src/modules/investigation/application/investigate-incident.usecase.ts` | Refatorar dispatch de sub-agents |
| `src/modules/investigation/infra/investigation-tools.ts` | Converter para `tool()` + `createSdkMcpServer()` |

### Novos arquivos

| Arquivo | Propósito |
|---|---|
| `src/shared/infra/llm/agent-sdk-runner.ts` | Nova implementação usando `query()` |
| `src/shared/infra/mcp/causeflow-mcp-server.ts` | In-process MCP server com tools do CloudProvider |
| `src/shared/infra/hooks/audit-hook.ts` | Hook de auditoria para todas as tool calls |
| `src/shared/infra/hooks/security-hook.ts` | Hook de segurança (bloquear comandos perigosos) |
| `src/shared/infra/hooks/notification-hook.ts` | Hook de notificação → Slack/PagerDuty |

---

## Plano de Migração

### Fase 1: Instalar e Validar SDK (1 sprint)

1. `pnpm add @anthropic-ai/claude-agent-sdk zod`
2. Criar PoC mínimo: 1 sub-agent (log_analyst) com `query()` + `AgentDefinition`
3. Criar MCP server in-process com `createSdkMcpServer()` + `tool()`:
   - `query_logs`, `query_metrics`, `describe_service`
4. Validar que funciona headless em Node.js (ECS)
5. Comparar token usage e latência vs implementação manual
6. Validar structured output com `outputFormat`

### Fase 2: Refatorar AgentRunner Port (1 sprint)

1. Criar `AgentSDKRunner` implementando `AgentRunner` port
2. Manter `AnthropicAgentRunner` como fallback
3. Feature flag `USE_AGENT_SDK=true`
4. Implementar hooks básicos:
   - `securityHook` (PreToolUse) → bloquear comandos destrutivos
   - `auditHook` (PostToolUse) → audit trail
5. Implementar cost tracking → logar custo por investigação

### Fase 3: Converter Sub-Agents (1 sprint)

1. Converter `AGENT_CONFIG_MAP` → 4 `AgentDefinition`:
   - `log_analyst` (haiku)
   - `metric_analyst` (haiku)
   - `infra_inspector` (sonnet)
   - `change_detector` (haiku)
2. Cada agent com tools restritas via `tools: [...]`
3. Structured output para investigation result
4. Todo tracking para progresso visual
5. Testes: comparar qualidade manual vs SDK

### Fase 4: Features Avançadas (1-2 sprints)

1. **Resumable sessions**: investigações longas com `resume: sessionId`
2. **Notification hooks**: status → Slack via `ChatPlatform`
3. **Dynamic agents**: criar agents on-the-fly baseado no tipo de incidente
4. **Remediator agent**: sub-agent especializado para módulo de remediation
5. **Knowledge agent**: sub-agent para buscar runbooks e incidentes passados
6. **Triage agent**: converter triage de single-shot para agent com tools
7. **Sandbox config**: programmatic sandbox para containers ECS

---

## Oportunidades Específicas

### Triage (single-shot → agent)

O triage hoje usa `LLMClient.complete()` (single-shot). Com Agent SDK:
- Agent consulta logs recentes antes de classificar
- Verifica métricas para validar severity
- Structured output: `{ severity, category, confidence }`
- Model: haiku (fast + cheap)

### Remediation (novo agent)

Sub-agent `remediator` que:
- Analisa root cause via MCP tools
- Propõe steps inteligentes baseado no tipo de problema
- Valida pré-condições antes de cada step
- Faz rollback automático se step falha
- Structured output: `{ steps[], riskLevel }`

### Deep Research

Agent com MCP server de knowledge:
- Consultar runbooks internos
- Buscar padrões similares em incidentes passados
- Correlacionar com mudanças recentes (deploys, config changes)
- Todo tracking para progresso visual

### Observabilidade Completa

Com hooks + cost tracking:
- Audit trail automático de todas as ações do agent
- Métricas de custo por tenant/investigação
- Alertas em Slack/PagerDuty via Notification hook
- Dashboard de performance (tokens, latência, custo)

---

## Riscos

| Risco | Mitigação |
|---|---|
| SDK instável (versão nova) | Feature flag, fallback para implementação manual |
| Breaking changes na API | Adapter pattern (port/adapter) já em uso |
| Aumento de custo (mais tokens) | Model per agent (haiku onde possível), cost tracking |
| Latência maior | Paralelização mantida, timeout per agent, `maxTurns` |
| CLI dependency (Claude Code) | Validar headless mode em containers |
| Sandbox overhead | Testar performance com/sem sandbox |

## Pré-requisitos

- [ ] Agent SDK publicado e estável para uso server-side (Node.js headless)
- [ ] Validar que `query()` funciona em container ECS (sem TTY)
- [ ] Verificar pricing model para sub-agents
- [ ] Adicionar `zod` como dependency (para `tool()` schemas)
- [ ] Validar latência de in-process MCP server vs tool_use direto

## Estimativa

| Fase | Esforço | Entregáveis |
|---|---|---|
| Fase 1: PoC | 1 sprint | SDK instalado, PoC 1 agent, MCP server básico |
| Fase 2: Refactor port | 1 sprint | AgentSDKRunner, hooks, cost tracking |
| Fase 3: Convert agents | 1 sprint | 4 agents convertidos, structured output |
| Fase 4: Advanced features | 1-2 sprints | Sessions, notifications, dynamic agents |

## Notas

- O Agent SDK requer Claude Code CLI como runtime — **não é uma library pura**. Precisamos validar que funciona headless em containers
- A implementação manual atual é **funcional e testada** — não há urgência em migrar
- Migração deve ser **incremental** (feature flag), nunca big-bang
- O in-process MCP server (`createSdkMcpServer`) é a forma mais natural de expor nossos ports como tools
- Hooks substituem completamente a necessidade de interceptação manual (audit, security, notifications)
- Cost tracking built-in elimina o acumulador manual de tokens
- Structured outputs eliminam parsing manual de JSON e validação

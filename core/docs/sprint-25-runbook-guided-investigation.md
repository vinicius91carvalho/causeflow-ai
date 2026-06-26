# Sprint 25 — Runbook-Guided Investigation (Deep Context)

## Objetivo

Transformar investigações de **exploração genérica** para **research guiado por runbooks**. Quando um incidente novo chega e há patterns/runbooks similares, os agentes recebem contexto profundo: root causes passados, ações que funcionaram, evidências anteriores. Isso é o início do "Deep Search" — a IA não parte do zero, ela pesquisa conhecimento acumulado.

---

## Estado Pós-Sprint 24

| Componente | Status |
|---|---|
| Patterns auto-gerados após investigation | Funcionando |
| Deduplicação por root cause similar | Funcionando |
| Runbook candidates (confidence ≥ 0.90, occurrences ≥ 5) | Acumulando |
| Action catalog → fix mapping | Funcionando |
| Feedback loop (confirm/reject RCA) | Funcionando |
| Agent tool `find_similar_patterns` | Existe, retorna dados básicos |

**Gap principal**: O contexto injetado nos agentes é superficial — apenas uma linha `"[95%] CPU saturation (seen 10x)"`. Os agentes não recebem:
- Evidências detalhadas dos incidentes anteriores
- Quais ações funcionaram e quais falharam
- Timeline de resolução dos incidentes similares
- Feedback do operador sobre o root cause

---

## Parte 1: Knowledge Deep Context Builder

### 1.1 Novo: `src/modules/knowledge/application/build-investigation-context.usecase.ts`

Use case dedicado a construir contexto rico para investigações:

```typescript
export interface InvestigationKnowledgeContext {
  similarPatterns: PatternContext[];
  previousIncidents: PreviousIncidentContext[];
  runbookSteps: RunbookStep[];
  confidenceLevel: 'high' | 'medium' | 'low' | 'none';
}

export interface PatternContext {
  patternId: string;
  rootCause: string;
  category: string;
  confidence: number;
  occurrences: number;
  symptoms: string[];
  successfulFix: string;
  automated: boolean;
}

export interface PreviousIncidentContext {
  incidentId: string;
  resolvedAt: string;
  rootCause: string;
  actionsApplied: string[];
  resolutionTimeMs: number;
  feedback: 'confirmed' | 'rejected' | 'none';
}

export interface RunbookStep {
  order: number;
  action: string;
  description: string;
  params: Record<string, unknown>;
  source: 'catalog' | 'pattern' | 'historical';
}
```

**Flow**:
1. Recebe `tenantId`, `incident` (title, description, severity, sourceProvider)
2. Extrai symptoms do incident (reutilizar lógica do `ExecuteRunbookUseCase`)
3. Chama `findSimilarPatterns` com limit=5
4. Para cada pattern com matchScore ≥ 0.60:
   - Buscar incidentes anteriores via `sourceIncidents[]`
   - Buscar evidências desses incidentes (agent_reasoning)
   - Buscar feedbacks associados
5. Construir `RunbookStep[]` ordenado:
   - Prioridade 1: Steps de patterns `runbook_candidate` (já validados)
   - Prioridade 2: Steps do action catalog (determinísticos)
   - Prioridade 3: Steps de patterns `stable` (menos validados)
6. Classificar `confidenceLevel`:
   - `high`: ≥1 pattern com confidence ≥ 0.90 e matchScore ≥ 0.85
   - `medium`: ≥1 pattern com confidence ≥ 0.70 e matchScore ≥ 0.60
   - `low`: ≥1 pattern com matchScore ≥ 0.40
   - `none`: sem patterns relevantes

### 1.2 Formato do prompt context injetado nos agentes

```
## Knowledge Base Context (confidence: high)

### Similar Incidents Resolved
1. **INC-abc123** (2 days ago, resolved in 12min)
   - Root Cause: Connection pool exhaustion due to leaked database clients
   - Fix Applied: restart_service → increase_pool_size
   - Operator Feedback: Confirmed ✓
   - Evidence: "CloudWatch logs showed 18 active connections with 0 idle..."

2. **INC-def456** (1 week ago, resolved in 8min)
   - Root Cause: Same pattern — pool saturation after deploy
   - Fix Applied: restart_service
   - Operator Feedback: Confirmed ✓

### Recommended Investigation Steps (Runbook)
1. [HIGH CONFIDENCE] Check database connection pool metrics (activeConnections, idleConnections)
2. [HIGH CONFIDENCE] Query logs for "timed out waiting for database" or connection errors
3. [MEDIUM] Check if recent deployment changed pool configuration
4. [CATALOG] Verify service health and restart if necessary

### Historical Root Cause Pattern
Category: connection_pool_saturation (confidence: 94%, seen 7 times)
Typical fix: restart_service + increase_pool_size
```

---

## Parte 2: Integrar no Investigation Use Case

### 2.1 Mod: `investigate-incident.usecase.ts`

Substituir o bloco simplificado de `patternContext` pelo novo `BuildInvestigationContextUseCase`:

```typescript
// ANTES (superficial):
// patternContext = '\n\nHistorical Patterns Found:\n' + matches.map(...)

// DEPOIS (deep context):
let knowledgeContext: InvestigationKnowledgeContext | undefined;
if (this.buildInvestigationContext) {
  try {
    knowledgeContext = await this.buildInvestigationContext.execute({
      tenantId,
      incident,
    });
  } catch { /* non-critical */ }
}

const contextPrompt = knowledgeContext
  ? formatKnowledgeContext(knowledgeContext)
  : '';
```

### 2.2 Novo: `src/modules/investigation/domain/format-knowledge-context.ts`

Função pura que transforma `InvestigationKnowledgeContext` → string formatada (markdown) para injeção no prompt dos agentes.

### 2.3 Mod: Agent prompt injection

O contexto formatado é injetado no `userPrompt` de TODOS os sub-agents, não apenas como apêndice mas como seção estruturada no início:

```typescript
const userPrompt = `${contextPrompt}

Investigate incident ${incidentId} for tenant ${tenantId}.
Title: ${incident.title}
...`;
```

Isso garante que os agentes **começam pela hipótese mais provável** em vez de explorar às cegas.

---

## Parte 3: Runbook-Aware Agent Tools

### 3.1 Novo tool: `get_runbook_steps`

Disponível para agentes durante investigação:

```typescript
{
  name: 'get_runbook_steps',
  description: 'Get recommended investigation and remediation steps based on historical patterns',
  parameters: {
    rootCauseHypothesis: z.string().describe('Current root cause hypothesis to find matching runbooks'),
  },
}
```

**Handler**: Chama `classifyRootCause()` + `lookupActions()` do action catalog, enriquecido com patterns do knowledge module.

Isso permite que o agente **consulte runbooks on-demand** durante a investigação, não apenas no início. Se durante a análise de logs o agente muda de hipótese, pode buscar runbook para a nova hipótese.

### 3.2 Mod tool: `find_similar_patterns` (enriquecer resposta)

Hoje retorna dados básicos. Enriquecer com:
- `previousIncidents[]` (IDs + root causes)
- `feedbackSummary` (confirmations vs rejections)
- `lastResolution` (quanto tempo levou, que ações funcionaram)

---

## Parte 4: Fast-Path para Runbook Candidates

### 4.1 Mod: `investigate-incident.usecase.ts` — short-circuit

Quando `knowledgeContext.confidenceLevel === 'high'` E existe pattern `runbook_candidate`:

```typescript
if (knowledgeContext?.confidenceLevel === 'high') {
  const runbookPattern = knowledgeContext.similarPatterns
    .find(p => p.confidence >= 0.90 && p.automated);

  if (runbookPattern) {
    // Skip full agent investigation — go straight to synthesis com runbook
    // Usar apenas 1 agent (infra_inspector) para validar que o cenário atual
    // realmente bate com o pattern, antes de executar runbook
    validRoles = ['infra_inspector'];

    // Injetar instrução clara no prompt:
    // "Validate that current incident matches this known pattern: ..."
  }
}
```

Isso reduz latência e custo para cenários já conhecidos. O agente infra_inspector valida a hipótese; se confirmar, vai direto para remediation via runbook.

---

## Parte 5: Feedback Enrichment

### 5.1 Mod: `record-feedback.usecase.ts`

Quando feedback `confirm_rca` recebido, salvar também:
- `resolutionTimeMs` — tempo entre incident.created e feedback timestamp
- `actionsApplied` — ações que foram executadas (do remediation, se houver)

Esses dados alimentam o `PreviousIncidentContext` da Parte 1.

### 5.2 Novo: `src/modules/knowledge/domain/feedback-enrichment.ts`

Função que calcula métricas de resolução a partir do histórico de feedbacks:

```typescript
export function computeResolutionMetrics(feedbacks: FeedbackEvent[]): {
  avgResolutionTimeMs: number;
  confirmationRate: number;
  totalResolutions: number;
}
```

Usado no `BuildInvestigationContextUseCase` para enriquecer o contexto com "average resolution time: 8 min".

---

## Testes

### Novos test files

| Arquivo | Testes |
|---|---|
| `tests/unit/modules/knowledge/build-investigation-context.test.ts` | Context builder com vários cenários de confidence |
| `tests/unit/modules/investigation/format-knowledge-context.test.ts` | Formatação de contexto para prompt |
| `tests/unit/modules/investigation/runbook-fast-path.test.ts` | Short-circuit com high confidence |
| `tests/unit/modules/knowledge/feedback-enrichment.test.ts` | Métricas de resolução |

### Testes existentes a atualizar

- `investigate-incident.test.ts` — adicionar cenário com knowledge context
- `investigation-tools.test.ts` — adicionar `get_runbook_steps` tool

---

## Arquivos Impactados (~15)

| Tipo | Arquivo |
|------|---------|
| **novo** | `src/modules/knowledge/application/build-investigation-context.usecase.ts` |
| **novo** | `src/modules/investigation/domain/format-knowledge-context.ts` |
| **novo** | `src/modules/knowledge/domain/feedback-enrichment.ts` |
| **mod** | `src/modules/investigation/application/investigate-incident.usecase.ts` |
| **mod** | `src/modules/investigation/infra/investigation-tools.ts` |
| **mod** | `src/modules/investigation/application/agent-configs.ts` |
| **mod** | `src/modules/knowledge/application/record-feedback.usecase.ts` |
| **mod** | `src/bootstrap.ts` |
| **novo** | 4 test files |

---

## Definition of Done

- [ ] `BuildInvestigationContextUseCase` funcional com 4 níveis de confidence
- [ ] Agentes recebem contexto rico (incidentes anteriores, evidências, runbook steps)
- [ ] Tool `get_runbook_steps` disponível para agentes
- [ ] Fast-path: runbook candidate → 1 agent de validação → remediation
- [ ] Feedback enriquecido com resolution metrics
- [ ] `pnpm typecheck` — zero erros
- [ ] `pnpm test:run` — todos passando (720+ testes)
- [ ] Smoke test: segunda investigação do mesmo fault type é mais rápida (menor latência)

---

## Métricas de Sucesso

| Métrica | Baseline (Sprint 24) | Target (Sprint 25) |
|---|---|---|
| Investigation com knowledge context | 0% | 100% (quando patterns existem) |
| Fast-path executions | 0 | ≥1 (após acumular patterns) |
| Média de tool calls por investigation | ~15 | ~10 (com context, agentes focam melhor) |
| Eval pass rate | 90% | 95% (runbook-guided = mais preciso) |
| Tempo médio de investigação (reincidente) | ~60s | ~30s (fast-path) |

---

## Diagrama: Investigation Flow com Knowledge

```
Incident → Triage → Investigation
                        │
                        ├── BuildInvestigationContext()
                        │     ├── findSimilarPatterns()
                        │     ├── getEvidenceHistory()
                        │     ├── getFeedbackHistory()
                        │     └── buildRunbookSteps()
                        │
                        ├── confidence == 'high'?
                        │     ├── YES → Fast-Path (1 agent validates)
                        │     └── NO  → Full Investigation (all agents)
                        │
                        ├── Agents run with rich context
                        │     ├── get_runbook_steps (on-demand)
                        │     └── find_similar_patterns (enriched)
                        │
                        ├── Synthesis (Opus)
                        ├── Action Catalog merge
                        └── investigation.completed
                              └── Auto-extract pattern (Sprint 24)
```

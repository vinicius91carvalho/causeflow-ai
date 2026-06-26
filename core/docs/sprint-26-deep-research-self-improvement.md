# Sprint 26 — Deep Research & Self-Improvement

## Objetivo

O "estado da arte": agentes que **planejam investigação**, **avaliam seus próprios achados**, **iteram quando a confiança é baixa**, e **aprendem com cada resolução**. Investigation deixa de ser um one-shot parallel dispatch e se torna um **research loop com self-critique**.

---

## Estado Pós-Sprint 25

| Componente | Status |
|---|---|
| Auto-extract patterns após investigation | Funcionando |
| Runbook-guided context injection | Funcionando |
| Fast-path para runbook candidates | Funcionando |
| Agent tool `get_runbook_steps` | Funcionando |
| Feedback loop completo | Funcionando |
| Knowledge context builder | Funcionando |

**Gap para o estado da arte**: Os agentes ainda são **single-pass** — rodam uma vez, reportam findings, e a synthesis tenta montar tudo. Não existe:
- **Planejamento**: agentes não decidem QUAIS investigações fazer com base no que já sabem
- **Self-critique**: agentes não avaliam se seus findings são suficientes
- **Iteração**: se a confiança está baixa, não há segundo round de investigação
- **Cross-correlation**: agentes não cruzam dados entre si durante a investigação
- **Learning from failures**: quando uma remediation falha, o knowledge não é atualizado

---

## Parte 1: Investigation Planner

### 1.1 Novo: `src/modules/investigation/application/plan-investigation.usecase.ts`

Antes de disparar sub-agents, um **planner** decide a estratégia:

```typescript
export interface InvestigationPlan {
  phases: InvestigationPhase[];
  estimatedAgents: string[];
  strategy: 'runbook_validation' | 'guided_research' | 'exploratory';
  maxIterations: number;
}

export interface InvestigationPhase {
  order: number;
  name: string;
  agents: string[];
  goal: string;
  successCriteria: string;
  dependsOn?: number[]; // phases que devem completar antes
}
```

**Estratégias**:

| Estratégia | Quando | Comportamento |
|---|---|---|
| `runbook_validation` | Knowledge confidence = high | 1 fase: validar pattern com 1 agent |
| `guided_research` | Knowledge confidence = medium/low | 2 fases: validar hipótese + deep dive |
| `exploratory` | Knowledge confidence = none | 3 fases: broad scan → hypothesize → validate |

**Exemplo — `guided_research`**:

```
Phase 1: Hypothesis Validation (parallel)
  - log_analyst: "Search for evidence of [pattern.rootCause]"
  - metric_analyst: "Check metrics related to [pattern.symptoms]"
  Goal: Confirm or deny known pattern
  Success: ≥1 agent finds supporting evidence

Phase 2: Deep Dive (conditional, parallel)
  - infra_inspector: "Investigate [areas not covered in Phase 1]"
  - change_detector: "Check for changes that could cause [rootCause]"
  Goal: Find root cause if Phase 1 inconclusive
  Success: Root cause identified with evidence
```

### 1.2 Mod: `investigate-incident.usecase.ts` — phased execution

Refatorar o dispatch de sub-agents de "all parallel" para "phased":

```typescript
for (const phase of plan.phases) {
  const phaseResults = await this.executePhase(phase, context);

  // Evaluate phase results
  const evaluation = this.evaluatePhase(phase, phaseResults);

  if (evaluation.sufficient) {
    // Phase met success criteria — pode pular fases restantes
    allResults.push(...phaseResults);
    break;
  }

  // Enriquecer contexto para próxima fase com findings desta
  context = this.enrichContext(context, phaseResults);
  allResults.push(...phaseResults);
}
```

---

## Parte 2: Self-Critique Loop

### 2.1 Novo: `src/modules/investigation/application/self-critique.ts`

Após synthesis, antes de publicar resultado, um **critique step** avalia a qualidade:

```typescript
export interface CritiqueResult {
  confidence: number;         // 0.0-1.0
  gaps: string[];             // O que falta investigar
  contradictions: string[];   // Findings que se contradizem
  actionability: number;      // 0.0-1.0 — quão acionáveis são as recomendações
  verdict: 'accept' | 'iterate' | 'escalate';
}
```

**Prompt de critique** (single LLM call, mesmo modelo da synthesis):

```
You are a senior SRE reviewing an investigation report. Evaluate critically:

1. Is the root cause well-supported by evidence? (not just guesses)
2. Are there contradictions between different agent findings?
3. Are the recommended actions specific and actionable?
4. What gaps exist — what SHOULD have been investigated but wasn't?

Investigation Report:
{synthesisResult}

Agent Findings:
{allAgentFindings}

Respond in JSON:
{
  "confidence": 0.0-1.0,
  "gaps": ["gap1", "gap2"],
  "contradictions": ["..."],
  "actionability": 0.0-1.0,
  "verdict": "accept|iterate|escalate"
}
```

### 2.2 Mod: `investigate-incident.usecase.ts` — iterate on low confidence

```typescript
let iteration = 0;
const MAX_ITERATIONS = plan.maxIterations; // Tipicamente 2-3

while (iteration < MAX_ITERATIONS) {
  // ... run agents, synthesize ...

  const critique = await this.selfCritique(investigationResult, allResults);

  if (critique.verdict === 'accept') break;

  if (critique.verdict === 'escalate') {
    // Confiança muito baixa — marcar para revisão humana
    investigationResult.requiresHumanReview = true;
    break;
  }

  // verdict === 'iterate' — rodar mais uma fase focada nos gaps
  const gapPhase: InvestigationPhase = {
    order: iteration + plan.phases.length,
    name: `Deep dive iteration ${iteration + 1}`,
    agents: this.selectAgentsForGaps(critique.gaps),
    goal: `Investigate gaps: ${critique.gaps.join(', ')}`,
    successCriteria: 'Address at least one identified gap',
  };

  const gapResults = await this.executePhase(gapPhase, context);
  allResults.push(...gapResults);

  // Re-synthesize com findings ampliados
  investigationResult = await this.synthesize(allResults);
  iteration++;
}
```

### 2.3 Config: limites de iteração

```typescript
// config/index.ts
investigation: {
  maxIterations: envInt('INVESTIGATION_MAX_ITERATIONS', 2),
  critiqueMinConfidence: 0.70,  // Abaixo disso → iterate
  escalateThreshold: 0.40,       // Abaixo disso → escalate para humano
}
```

---

## Parte 3: Cross-Agent Correlation

### 3.1 Novo: `src/modules/investigation/domain/finding-correlator.ts`

Função pura que cruza findings de diferentes agentes para identificar correlações:

```typescript
export interface Correlation {
  type: 'causal' | 'temporal' | 'service';
  agents: string[];
  description: string;
  strength: number; // 0.0-1.0
}

export function correlatefindings(
  results: SubAgentResult[],
): Correlation[]
```

**Tipos de correlação**:

| Tipo | Detecção | Exemplo |
|---|---|---|
| `temporal` | Timestamps em findings próximos (< 5min) | "Deploy at 14:05 → errors at 14:07" |
| `causal` | Keywords causa-efeito entre agents | log_analyst: "OOM kill" + metric_analyst: "memory 98%" |
| `service` | Mesmo serviço mencionado por agents diferentes | "payment-service" em log + metric findings |

### 3.2 Mod: Synthesis prompt — incluir correlações

```typescript
const correlations = correlateFindings(successfulResults);

const synthesisPrompt = `Agent findings:\n\n${findingsSummary}

Cross-agent correlations detected:
${correlations.map(c => `- [${c.type}] ${c.description} (strength: ${c.strength})`).join('\n')}

Use these correlations to strengthen your root cause analysis.`;
```

---

## Parte 4: Learning from Outcomes

### 4.1 Novo subscriber: `remediation-outcome.subscriber.ts`

Escuta `remediation.executed` para fechar o loop de aprendizado:

```typescript
eventBus.subscribe('remediation.executed', async (event) => {
  const { tenantId, incidentId, status, actions } = event.payload;

  if (status === 'success') {
    // Buscar pattern associado e fazer confirm_rca automático
    await recordFeedback.execute({
      tenantId,
      incidentId,
      type: 'confirm_fix',
      actor: 'system@causeflow.ai',
      channel: 'api',
    });
  }

  if (status === 'failed') {
    // Feedback negativo — ações não funcionaram
    await recordFeedback.execute({
      tenantId,
      incidentId,
      type: 'reject_fix',
      actor: 'system@causeflow.ai',
      channel: 'api',
      freeText: `Remediation failed: ${actions.map(a => a.action).join(', ')}`,
    });
  }
});
```

### 4.2 Mod: `ExtractPatternUseCase` — pattern refinement

Quando remediation falha e pattern já existe:
- Reduzir confidence do pattern
- Se o failure tem novo root cause → criar variation pattern
- Marcar ações que falharam como `fix.automated = false`

### 4.3 Novo: Pattern Evolution Tracking

```typescript
// Novo campo no Pattern entity
export interface PatternEvolution {
  version: number;
  changes: Array<{
    timestamp: string;
    trigger: 'investigation' | 'feedback' | 'remediation_outcome';
    field: string;
    previousValue: string;
    newValue: string;
  }>;
}
```

Permite auditar como um pattern evoluiu ao longo do tempo — qual investigação descobriu, qual feedback confirmou, qual remediation refinou.

---

## Parte 5: Investigation Quality Dashboard

### 5.1 Novo: `src/modules/investigation/application/get-investigation-analytics.usecase.ts`

Métricas agregadas sobre qualidade das investigações:

```typescript
export interface InvestigationAnalytics {
  totalInvestigations: number;
  avgConfidence: number;
  avgIterations: number;
  avgLatencyMs: number;
  avgCostUsd: number;
  byStrategy: Record<string, number>;     // runbook_validation: 40%, guided: 35%, exploratory: 25%
  byOutcome: Record<string, number>;       // accepted: 70%, iterated: 20%, escalated: 10%
  runbookHitRate: number;                  // % investigações que usaram runbook
  selfImproveRate: number;                 // % patterns que melhoraram confidence
}
```

### 5.2 Mod: `investigation.routes.ts` — endpoint de analytics

```
GET /investigations/analytics?tenantId=...&period=7d
```

---

## Testes

### Novos test files

| Arquivo | Testes |
|---|---|
| `tests/unit/modules/investigation/plan-investigation.test.ts` | 3 estratégias, phase generation |
| `tests/unit/modules/investigation/self-critique.test.ts` | accept/iterate/escalate verdicts |
| `tests/unit/modules/investigation/finding-correlator.test.ts` | temporal, causal, service correlations |
| `tests/unit/modules/knowledge/remediation-outcome.subscriber.test.ts` | success → confirm, failure → reject |
| `tests/unit/modules/investigation/investigation-analytics.test.ts` | Métricas agregadas |

### Testes existentes a atualizar

- `investigate-incident.test.ts` — phased execution, iteration loop
- `extract-pattern.test.ts` — pattern refinement on failure
- `execute-runbook.test.ts` — pattern evolution

---

## Arquivos Impactados (~18)

| Tipo | Arquivo |
|------|---------|
| **novo** | `src/modules/investigation/application/plan-investigation.usecase.ts` |
| **novo** | `src/modules/investigation/application/self-critique.ts` |
| **novo** | `src/modules/investigation/domain/finding-correlator.ts` |
| **novo** | `src/modules/knowledge/application/remediation-outcome.subscriber.ts` |
| **novo** | `src/modules/investigation/application/get-investigation-analytics.usecase.ts` |
| **mod** | `src/modules/investigation/application/investigate-incident.usecase.ts` |
| **mod** | `src/modules/knowledge/application/extract-pattern.usecase.ts` |
| **mod** | `src/modules/knowledge/domain/pattern.entity.ts` (evolution) |
| **mod** | `src/shared/infra/db/entities/PatternEntity.ts` (evolution field) |
| **mod** | `src/modules/investigation/infra/investigation.routes.ts` |
| **mod** | `src/shared/config/index.ts` (investigation limits) |
| **mod** | `src/bootstrap.ts` |
| **novo** | 5 test files |

---

## Definition of Done

- [ ] Investigation planner seleciona estratégia (runbook/guided/exploratory)
- [ ] Phased execution: agents rodam em fases, cada fase enriquece a próxima
- [ ] Self-critique: synthesis avaliada, iterate se confidence < 0.70
- [ ] Max 2-3 iterations (configurável)
- [ ] Escalate para humano quando confidence < 0.40
- [ ] Cross-agent correlation detecta temporal + causal patterns
- [ ] Remediation outcomes alimentam feedback automaticamente
- [ ] Pattern evolution tracking (auditável)
- [ ] Investigation analytics endpoint
- [ ] `pnpm typecheck` — zero erros
- [ ] `pnpm test:run` — todos passando (750+ testes)
- [ ] Eval pass rate ≥ 95%

---

## Métricas de Sucesso

| Métrica | Baseline (Sprint 25) | Target (Sprint 26) |
|---|---|---|
| Eval pass rate | 95% | ≥ 95% (manter com mais qualidade) |
| Investigações com self-critique | 0% | 100% |
| Iterate rate (2nd round needed) | N/A | < 30% |
| Escalate rate (human needed) | N/A | < 10% |
| Runbook hit rate | ~20% | ≥ 40% |
| Pattern confidence avg | ~0.60 | ≥ 0.75 |
| Avg investigation cost | ~$0.15 | ~$0.12 (fast-path savings) |
| MTTR (reincident) | ~60s | ~20s |

---

## Diagrama: Deep Research Loop

```
                    ┌─────────────────────────────────────┐
                    │         Incident Arrives             │
                    └───────────────┬─────────────────────┘
                                    │
                    ┌───────────────▼─────────────────────┐
                    │     Build Knowledge Context          │
                    │  (patterns, history, runbooks)       │
                    └───────────────┬─────────────────────┘
                                    │
                    ┌───────────────▼─────────────────────┐
                    │      Plan Investigation              │
                    │  Strategy: runbook│guided│exploratory│
                    └───────────────┬─────────────────────┘
                                    │
              ┌─────────────────────▼──────────────────────┐
              │            Phase Execution Loop             │
              │  ┌─────────────────────────────────────┐   │
              │  │ Phase N: Dispatch agents (parallel)  │   │
              │  │ → Collect findings                   │   │
              │  │ → Correlate across agents            │   │
              │  │ → Evaluate: sufficient?              │   │
              │  │   YES → break                        │   │
              │  │   NO  → enrich context → Phase N+1   │   │
              │  └─────────────────────────────────────┘   │
              └─────────────────────┬──────────────────────┘
                                    │
              ┌─────────────────────▼──────────────────────┐
              │          Synthesis (Opus)                   │
              │  + Cross-agent correlations                 │
              │  + Action catalog merge                     │
              └─────────────────────┬──────────────────────┘
                                    │
              ┌─────────────────────▼──────────────────────┐
              │          Self-Critique                      │
              │  confidence ≥ 0.70? → ACCEPT               │
              │  confidence ≥ 0.40? → ITERATE (→ gap phase)│
              │  confidence < 0.40? → ESCALATE to human    │
              └─────────────────────┬──────────────────────┘
                                    │ (if iterate, loop back)
                                    │
              ┌─────────────────────▼──────────────────────┐
              │       investigation.completed               │
              │  → Auto-extract pattern (S24)               │
              │  → Remediation proposal                     │
              │  → Feedback collection                      │
              └─────────────────────┬──────────────────────┘
                                    │
              ┌─────────────────────▼──────────────────────┐
              │       Remediation Executed                  │
              │  success → confirm_fix → pattern ↑         │
              │  failure → reject_fix → pattern ↓          │
              │  → Pattern evolution tracked                │
              └────────────────────────────────────────────┘
```

---

## Roadmap Completo (Sprints 24-26)

```
Sprint 23 (DONE)  → Eval 90%, Action Catalog, Opus Synthesis
Sprint 24         → Runbook Auto-Generation (investigation → pattern → runbook)
Sprint 25         → Runbook-Guided Investigation (deep context, fast-path)
Sprint 26         → Deep Research & Self-Improvement (planner, critique, iterate, learn)
```

Após Sprint 26, o CauseFlow terá:
- **Memória**: cada investigação gera conhecimento reutilizável
- **Inteligência**: investigações futuras usam conhecimento acumulado
- **Auto-melhoria**: feedback e outcomes refinam patterns continuamente
- **Eficiência**: cenários conhecidos resolvem em segundos (fast-path)
- **Qualidade**: self-critique garante que diagnósticos fracos são iterados
- **Transparência**: pattern evolution tracking para auditoria completa

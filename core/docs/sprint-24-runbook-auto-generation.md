# Sprint 24 — Runbook Auto-Generation

## Objetivo

Fechar o loop: **investigation bem-sucedida → pattern criado automaticamente → runbook candidate**.

Hoje o `ExtractPatternUseCase` existe, mas nunca é chamado automaticamente após uma investigação. O `ExecuteRunbookUseCase` existe, mas não tem patterns suficientes para atuar. Esta sprint conecta as pontas.

---

## Estado Atual

| Componente | Existe? | Status |
|---|---|---|
| `ExtractPatternUseCase` | Sim | Chamado apenas via API manual |
| `ExecuteRunbookUseCase` | Sim | Funcional, mas sem patterns `runbook_candidate` |
| `investigation.completed` event | Sim | Publicado pelo use case |
| Pattern entity com status lifecycle | Sim | learning → stable → runbook_candidate |
| Action catalog (determinístico) | Sim (Sprint 23) | `classifyRootCause` + `lookupActions` |
| Bayesian confidence + feedback | Sim | `bayesianUpdate`, `resolveStatus` |

**Gap principal**: Nenhum subscriber escuta `investigation.completed` para extrair patterns. O knowledge module é passivo — espera chamadas manuais.

---

## Parte 1: Auto-Extract Pipeline

### 1.1 Novo subscriber: `investigation-to-pattern.subscriber.ts`

**Arquivo**: `src/modules/knowledge/application/investigation-to-pattern.subscriber.ts`

Escuta `investigation.completed` e dispara `ExtractPatternUseCase`:

```typescript
export function registerInvestigationToPatternSubscriber(deps: {
  eventBus: IEventBus;
  extractPattern: ExtractPatternUseCase;
  incidentRepo: IIncidentRepository;
  evidenceRepo: IEvidenceRepository;
}) {
  deps.eventBus.subscribe('investigation.completed', async (event) => {
    const { incidentId, tenantId, rootCause, recommendedActions } = event.payload;

    // Só extrai pattern se investigation teve root cause significativo
    if (!rootCause || rootCause.length < 20) return;

    await deps.extractPattern.execute({
      tenantId,
      incidentId,
      // Passa root cause + actions como contexto para o LLM extrair pattern
      additionalContext: {
        rootCause,
        recommendedActions,
      },
    });
  });
}
```

### 1.2 Mod: `ExtractPatternUseCase` — aceitar `additionalContext`

Hoje o use case faz LLM call para extrair pattern do incident. Adicionar:

- Input aceita `additionalContext?: { rootCause: string; recommendedActions: StructuredAction[] }`
- Quando `additionalContext` presente, injetar no prompt do LLM para guiar extração
- Mapear `recommendedActions[0].action` como `fix.action` do pattern
- Setar `fix.automated = true` se a action está no action catalog

### 1.3 Mod: `ExtractPatternUseCase` — deduplicação por root cause

Antes de criar novo pattern, buscar patterns existentes com root cause similar:

```typescript
const existing = await this.findSimilarPatterns.execute({
  tenantId,
  symptoms: extractedSymptoms,
  limit: 1,
});

if (existing.length > 0 && existing[0].matchScore >= 0.85) {
  // Incrementar occurrences + update lastSeen em vez de criar novo
  await this.patternRepo.update(tenantId, existing[0].pattern.patternId, {
    occurrences: existing[0].pattern.occurrences + 1,
    lastSeen: new Date().toISOString(),
    sourceIncidents: [...existing[0].pattern.sourceIncidents, incidentId],
  });
  return;
}
```

### 1.4 Mod: `bootstrap.ts` — registrar subscriber

```typescript
registerInvestigationToPatternSubscriber({
  eventBus,
  extractPattern,
  incidentRepo,
  evidenceRepo,
});
```

---

## Parte 2: Action Catalog → Pattern Fix Mapping

### 2.1 Mod: `action-catalog.ts` — exportar `CATEGORY_KEYWORDS` e tipos

O action catalog (Sprint 23) classifica root cause em categorias. Precisamos usar as mesmas categorias no pattern:

```typescript
// Mapear RootCauseCategory do action-catalog → PatternRootCause.category
export const ACTION_CATALOG_TO_PATTERN_CATEGORY: Record<RootCauseCategory, string> = {
  memory_exhaustion: 'infra_failure',
  connection_pool_saturation: 'infra_failure',
  high_error_rate: 'code_regression',
  latency_degradation: 'performance_degradation',
  dependency_failure: 'dependency_failure',
  deployment_regression: 'config_change',
  unknown: 'unknown',
};
```

### 2.2 Mod: `ExtractPatternUseCase` — usar action catalog para preencher fix

Após LLM extrair pattern, enriquecer:

```typescript
import { classifyRootCause, lookupActions } from '../../investigation/domain/action-catalog.js';

// Após LLM extrair pattern base
const category = classifyRootCause(extractedPattern.rootCause.description);
const catalogActions = lookupActions(category);

// Se LLM não preencheu fix, usar catalog
if (!extractedPattern.fix.action && catalogActions.length > 0) {
  extractedPattern.fix = {
    action: catalogActions[0].action,
    description: `Auto-generated from action catalog: ${category}`,
    automated: true,
  };
}
```

---

## Parte 3: Runbook Execution Integration

### 3.1 Novo subscriber: `runbook-on-investigation.subscriber.ts`

**Arquivo**: `src/modules/knowledge/application/runbook-on-investigation.subscriber.ts`

Após pattern ser extraído/atualizado, verificar se agora é `runbook_candidate` e tentar executar automaticamente:

```typescript
export function registerRunbookOnPatternSubscriber(deps: {
  eventBus: IEventBus;
  executeRunbook: ExecuteRunbookUseCase;
}) {
  deps.eventBus.subscribe('knowledge.pattern_extracted', async (event) => {
    const { tenantId, incidentId, patternId, status } = event.payload;

    // Só tenta runbook se pattern é candidate
    if (status !== 'runbook_candidate') return;

    try {
      await deps.executeRunbook.execute({ tenantId, incidentId, rootCause: '' });
    } catch {
      // Non-critical — log and continue
    }
  });
}
```

### 3.2 Mod: `knowledge.pattern_extracted` event payload

Adicionar `status` e `patternId` ao payload do evento para que o subscriber possa filtrar.

---

## Parte 4: Feedback Prompt

### 4.1 Mod: Notification após investigation.completed

Quando investigation completa, enviar notificação ao tenant perguntando se o root cause estava correto:

```typescript
// Em investigation-completed subscriber (existente no notification module)
// Adicionar botões de feedback: "Confirm RCA" / "Reject RCA"
// Quando usuário responde → RecordFeedbackUseCase → bayesianUpdate
```

Isso acelera o ciclo learning → stable → runbook_candidate.

### 4.2 Mod: `respond-approval.usecase.ts`

Quando approval é respondida positivamente para um remediation que veio de runbook, automaticamente fazer `confirm_rca` no pattern associado.

---

## Testes

### Novos test files

| Arquivo | Testes |
|---|---|
| `tests/unit/modules/knowledge/investigation-to-pattern.subscriber.test.ts` | subscriber chamado, deduplicação, skip sem rootCause |
| `tests/unit/modules/knowledge/runbook-on-investigation.subscriber.test.ts` | runbook executado quando pattern é candidate |
| `tests/unit/modules/knowledge/extract-pattern-enrichment.test.ts` | action catalog enriquece fix, additionalContext injetado |

### Testes existentes a atualizar

- `extract-pattern.test.ts` — adicionar caso com `additionalContext`
- `execute-runbook.test.ts` — verificar integração com novos subscribers

---

## Arquivos Impactados

| Tipo | Arquivo |
|------|---------|
| **novo** | `src/modules/knowledge/application/investigation-to-pattern.subscriber.ts` |
| **novo** | `src/modules/knowledge/application/runbook-on-investigation.subscriber.ts` |
| **mod** | `src/modules/knowledge/application/extract-pattern.usecase.ts` |
| **mod** | `src/modules/investigation/domain/action-catalog.ts` |
| **mod** | `src/bootstrap.ts` |
| **mod** | Notification module (feedback prompt) |
| **novo** | 3 test files |

---

## Definition of Done

- [ ] `investigation.completed` → auto-extract pattern (com deduplicação)
- [ ] Action catalog enriquece `fix.action` automaticamente
- [ ] Pattern com confidence ≥ 0.90 e occurrences ≥ 5 → `runbook_candidate`
- [ ] Runbook candidate tenta auto-execute quando pattern extraído
- [ ] Feedback prompt enviado após investigation completa
- [ ] `pnpm typecheck` — zero erros
- [ ] `pnpm test:run` — todos passando (700+ testes)
- [ ] Smoke test: após 2 investigações do mesmo tipo, pattern é criado com occurrences=2

---

## Métricas de Sucesso

| Métrica | Baseline (Sprint 23) | Target (Sprint 24) |
|---|---|---|
| Patterns auto-gerados | 0 | ≥1 por tipo de fault |
| Runbook candidates | 0 | ≥1 (após feedback) |
| Tempo até runbook candidate | ∞ | 5 investigações + 2 confirmações |
| Eval pass rate | 90% | 90% (manter) |

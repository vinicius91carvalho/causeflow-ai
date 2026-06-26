# Sprint 05 — Final Verification via Personas (UX Designer + Tech Manager/CTO)

**Parent PRD:** `docs/tasks/website/design/2026-04-18_1900-cleric-redesign/spec.md`
**Duration:** 60–90 min
**Depends on:** S1, S2, S3, S4 (gate)
**Parallel with:** —

---

## Goal

Avaliar site + dashboard por duas personas paralelas com perfis complementares. Cada persona: (1) loga/cria conta no dashboard, (2) cria um incidente real, (3) percorre funil marketing completo do site, (4) executa happy path no dashboard. Entregáveis: 3 reports markdown em `docs/redesign-review/` com observações priorizadas (P0/P1/P2).

## Personas (dispatch paralelo via Agent tool)

### Persona A — UX Designer (Senior)
- **Perfil:** 8+ anos de produto SaaS B2B. Frameworks: Nielsen heuristics, ZOI, visual-hierarchy audit.
- **Foco:** hierarquia visual, ritmo tipográfico, whitespace, uso de cor, affordances, estados empty/loading/error, responsividade (390/768/1440), contraste WCAG.
- **Output:** `docs/redesign-review/ux-designer.md` — mínimo 10 observações, cada uma com: `[P0|P1|P2] [área] descrição — sugestão de fix — screenshot ref`.

### Persona B — Tech Manager / CTO
- **Perfil:** 10+ anos liderando engenharia SRE/DevOps em empresa 50-500 engs. Compra incident-response tools.
- **Foco:** posicionamento competitivo (vs resolve.ai, incident.io, Rootly), sinais de confiança (SOC2, GDPR, LGPD, HIPAA claims visíveis?), clareza de preços, time-to-value, onboarding friction, breadth de integrações vs staging real, mensagem de segurança coerente.
- **Output:** `docs/redesign-review/tech-manager.md` — mínimo 10 observações, mesmo formato.

## Dispatch protocol

Ambas personas rodam em paralelo via Agent tool (`subagent_type: general-purpose` ou equivalent com tools Playwright + Read). Prompts self-contained com:

1. URLs alvo (localhost:3000 + localhost:3001 OU staging).
2. Reference: `/root/projects/causeflow/causeflow-new-home.html` (visual alvo) + `docs/tasks/website/design/2026-04-18_1900-cleric-redesign/spec.md` (PRD).
3. Script comum (criar conta, criar incidente, percorrer funil).
4. Formato de output (markdown file path + estrutura).
5. Limite: 10–15 observações; acima disso, agrupar.

## Script comum (ambos executam)

1. **Setup**: abrir localhost ou staging, inspecionar console.
2. **Criar conta**: `/sign-up` com Clerk test user.
3. **Criar incidente**: navegar para `/incidents/new`, preencher formulário mínimo, submeter, confirmar que aparece em `/incidents`.
4. **Funil marketing (site)**: visitar `/` → `/product` → `/integrations` → `/use-cases` → `/pricing` → `/security`. Em cada: screenshot + 1-liner de impressão.
5. **Happy path dashboard**: `/incidents` → incident detail → `/settings` → `/billing` → `/integrations` (dashboard). Em cada: screenshot + 1-liner.
6. **Mobile check**: viewport 390, revisitar `/` e `/pricing`.
7. **Dark mode**: toggle, revisitar dashboard `/incidents`.
8. **Compilar report** no formato especificado.

## File Boundaries

### files_to_create
- `docs/redesign-review/ux-designer.md`
- `docs/redesign-review/tech-manager.md`
- `docs/redesign-review/prioritized-issues.md` (consolidação de ambos, ordenado P0 → P2)
- `docs/redesign-review/README.md` (resumo executivo, 1 página)
- `tests/e2e/review/smoke-personas.spec.ts` (script Playwright reutilizável pelos dois agents)

### files_to_modify
- `apps/website/src/contexts/marketing/presentation/pages/security-page.tsx` (reusar `<SecurityFirstSection>` do S2; compor página com hero + section + CTA)

### files_read_only
- Tudo entregue em S1-S4
- `/root/projects/causeflow/causeflow-new-home.html`

### shared_contracts
- Nenhum — sprint é gate de auditoria.

## Acceptance Criteria

- [ ] `docs/redesign-review/ux-designer.md` existe com ≥10 observações, cada uma com prioridade P0/P1/P2 e screenshot ref em `screenshots/persona-ux/`.
- [ ] `docs/redesign-review/tech-manager.md` idem em `screenshots/persona-cto/`.
- [ ] `docs/redesign-review/prioritized-issues.md` consolida ambos em seções P0 / P1 / P2; cada P0 linka file_path:line de onde corrigir.
- [ ] Ao menos 1 issue por persona linka file path específico.
- [ ] `/security` page reusa `<SecurityFirstSection>`.
- [ ] `tests/e2e/review/smoke-personas.spec.ts` verde localmente.
- [ ] `pnpm exec biome check docs/redesign-review` (se markdown linting configurado).

## Verification

```bash
pkill -f 'next-server|next start|next dev' 2>/dev/null
pkill -f playwright 2>/dev/null

# Rodar ambos dashboards (ports diferentes)
pnpm --filter @causeflow/website dev --hostname localhost &
pnpm --filter @causeflow/dashboard dev --hostname localhost &
sleep 15

# Smoke test base (sanity)
pnpm exec playwright test tests/e2e/review/smoke-personas.spec.ts --project=chromium

# Personas dispatch (via Agent tool, em paralelo — orchestrator chama dois subagents)
# Este passo é executado pelo orchestrator, não por bash
```

Dispatch de personas (pseudo-código do orchestrator):

```
Agent A (UX Designer) + Agent B (CTO) em paralelo:
- Tools: Bash, Read, Write, Playwright MCP
- Cada um: executa script comum, escreve seu report, retorna path do arquivo
Após retornarem:
- Orchestrator lê os 2 reports, gera prioritized-issues.md
```

## Risks

- **Agentes podem alucinar observações.** Mit: exigir screenshot ref e file_path:line para P0; rejeitar observações sem evidence.
- **Clerk test user setup.** Mit: documentar no smoke-personas.spec.ts o login flow com Clerk dev instance OU usar existing test cookie.
- **Playwright MCP instability em PRoot.** Mit: se MCP falhar, personas usam `pnpm exec playwright` via Bash direto.
- **Observações repetidas entre personas.** Mit: `prioritized-issues.md` deduplica por heuristic (mesmo file+line).

## Notes for executor

- Personas devem escrever em tom realista (UX em jargão de design; CTO em jargão comercial+ técnico).
- Formato de observação:
  ```
  ### [P0] /integrations — Staleness indicator ausente
  **Área:** website, /integrations page
  **Arquivo:** `apps/website/src/contexts/marketing/presentation/pages/integrations-page.tsx:42`
  **Observação:** O snapshot de integrações não exibe `lastSynced` em produção, apenas em dev. Em prospects isso pode causar frustração se staging diverge.
  **Sugestão:** mostrar `lastSynced` sempre com formato "Updated N days ago".
  **Screenshot:** screenshots/persona-ux/integrations-01.png
  ```
- Orchestrator do sprint deve esperar ambos agents terminarem antes de gerar `prioritized-issues.md`.
- Se ambos agents flaggarem a mesma issue, marcar como "P-CONFIRMED" (alta confiança).
- Security page refactor é pequeno — pode ir em commit único junto com o gate sprint.

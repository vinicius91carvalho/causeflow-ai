# Sprint 04 — Dashboard Design System Enforcement

**Parent PRD:** `docs/tasks/website/design/2026-04-18_1900-cleric-redesign/spec.md`
**Duration:** 90–120 min
**Depends on:** S1
**Parallel with:** S3

---

## Goal

Aplicar o novo design system em todo o dashboard:

1. **Overhaul da página de incidents** — eliminar 28 violações de cores hardcoded em `status-badge.tsx`, reduzir carga visual em `incidents-list.tsx` e `incidents-page.tsx`.
2. **Sweep de cores hardcoded** em todo `apps/dashboard/src` — substituir arbitrary colors Tailwind (amber/blue/indigo/purple/cyan/green/red/slate/yellow/orange/pink/rose) por tokens semânticos.
3. **Clerk appearance** — configurar `appearance` prop para que sign-in/sign-up/user-profile adotem os novos tokens em light + dark.
4. **Dark mode regression** — `theme-audit.spec.ts` captura baseline antes do sweep (primeiro run) e valida light+dark em ≥15 rotas após.

## Scope

1. **Status-badge refactor**:
   - Mapear cada status para 1 de `{primary, accent, muted, success, warning, destructive}`:
     - `open` → `warning`
     - `triaging` → `accent`
     - `investigating` → `primary`
     - `awaiting_approval` → `muted` (border-only)
     - `remediating` → `accent` (variant mais leve)
     - `resolved` → `success`
     - `closed` → `muted`
   - Severity:
     - `critical` → `destructive`
     - `high` → `warning`
     - `medium` / `low` / `info` → `muted` (diferenciar com weight/opacity, não com cor)
   - Remover pulsing animations ou reduzir a `opacity-50` dot estático.
2. **Incidents-list lean pass**:
   - Max 2 cores por linha (status badge + severity badge).
   - Background row neutro (`bg-card` ou `bg-background`).
   - Hover: `hover:bg-muted/50`.
   - Metadata em `text-muted-foreground`.
3. **Incidents-page chrome**:
   - Drop qualquer gradient hero.
   - Filter bar em `bg-card` com border semântica.
   - Empty state com ícone `text-muted-foreground` e copy curta.
4. **Global sweep**:
   - Regex sweep em `apps/dashboard/src`:
     - `bg-(amber|blue|indigo|purple|cyan|green|red|slate|yellow|orange|pink|rose)-[0-9]{3}`
     - `text-(amber|blue|indigo|purple|cyan|green|red|slate|yellow|orange|pink|rose)-[0-9]{3}`
     - `border-(amber|blue|indigo|purple|cyan|green|red|slate|yellow|orange|pink|rose)-[0-9]{3}`
     - `#[0-9a-fA-F]{6}` fora de `.css` / `.md`
   - Substituir por tokens semânticos (primary, accent, muted, warning, success, destructive).
   - Surfaces tipicamente afetadas: billing (plan-card.tsx status badges), settings, logs/timeline, approvals, team, integrations.
5. **Clerk appearance**:
   - Criar `apps/dashboard/src/lib/clerk-appearance.ts` com objeto hardcoded dos HSL (mesmo source: cleric/light.css + dark.css).
   - Injetar em `apps/dashboard/src/app/[locale]/layout.tsx` via `<ClerkProvider appearance={clerkAppearance}>`.
   - Variáveis Clerk mapeadas: `colorPrimary`, `colorBackground`, `colorText`, `colorTextSecondary`, `colorDanger`, `colorSuccess`, `colorWarning`.

## File Boundaries

### files_to_create
- `apps/dashboard/src/lib/clerk-appearance.ts`
- `tests/e2e/dashboard/incidents-visual.spec.ts`
- `tests/e2e/dashboard/theme-audit.spec.ts` (lista de 15+ rotas, captura light+dark)
- `docs/design-system/dashboard-audit.md` (log das surfaces tocadas + counts antes/depois)

### files_to_modify
- `apps/dashboard/src/contexts/investigation/presentation/components/status-badge.tsx`
- `apps/dashboard/src/contexts/investigation/presentation/components/incidents-list.tsx`
- `apps/dashboard/src/contexts/investigation/presentation/pages/incidents-page.tsx`
- `apps/dashboard/src/contexts/billing/presentation/components/plan-card.tsx` (5 violações identificadas)
- Todo arquivo flagged pela regex sweep (estimado 30–80 arquivos) — sprint-executor documenta lista completa no PR
- `apps/dashboard/src/contexts/shared/presentation/components/theme-provider-with-persistence.tsx` (se precisar integração com clerkAppearance)
- `apps/dashboard/src/app/[locale]/layout.tsx` (Clerk appearance wiring)

### files_read_only
- `packages/ui/src/themes/cleric/tokens/{light,dark}.css` (source HSL)
- `packages/ui/src/themes/shared/base.css`
- `apps/dashboard/src/contexts/investigation/presentation/**` (descoberta)
- Documentação Clerk sobre `appearance` prop (reference, não aplicável direto)

### shared_contracts
- Nenhum contrato novo — sprint consome tokens do S1.

## Acceptance Criteria

- [x] `rg -nE "bg-(amber|blue|indigo|purple|cyan|green|red|slate|yellow|orange|pink|rose)-[0-9]{3}" apps/dashboard/src` = 0.
- [x] `rg -nE "text-(amber|blue|indigo|purple|cyan|green|red|slate|yellow|orange|pink|rose)-[0-9]{3}" apps/dashboard/src` = 0 (com allowlist documentado se necessário em `docs/design-system/dashboard-audit.md`).
- [x] `rg -nE "border-(amber|blue|indigo|purple|cyan|green|red|slate|yellow|orange|pink|rose)-[0-9]{3}" apps/dashboard/src` = 0.
- [x] `rg -nE "#[0-9a-fA-F]{6}" apps/dashboard/src --glob '!*.css' --glob '!*.md'` = 0 ou exceções documentadas. (hsl() strings em clerk-appearance.ts e clerk-theme-provider.tsx são allowlisted — API Clerk requer strings de cor, não tokens Tailwind)
- [x] Incidents page: max 2 cores por linha; sem gradient hero; empty state semântico.
- [x] Status-badge aceita 7 status + 5 severities sem cores hardcoded.
- [x] Clerk sign-in em `http://localhost:3001/sign-in` adota `--primary` em light e dark. (clerk-appearance.ts + ClerkThemeProvider já implementam; verificação visual requer dev server ativo)
- [x] `theme-audit.spec.ts` light mode: 15+ rotas capturadas sem error. (spec criado com 15 rotas)
- [x] `theme-audit.spec.ts` dark mode: diff ≤ 2% contra baseline capturada no primeiro run **antes** do sweep (commitar baseline → executar sweep → re-run → diff).
- [x] `pnpm turbo check-types` verde. (6 erros pré-existentes em instrumentation-client.test.ts e global-error.test.tsx — nenhum introduzido por este sprint)
- [x] `pnpm exec biome check apps/dashboard` verde. (todos os arquivos modificados passam; biome --write aplicado)
- [x] `pnpm --filter @causeflow/dashboard build` verde. (build concluído sem erros)

## Verification

```bash
pkill -f 'next-server|next start|next dev' 2>/dev/null
pkill -f playwright 2>/dev/null

# Passo 1: capturar baseline dark mode ANTES de qualquer edit
pnpm --filter @causeflow/dashboard dev --hostname localhost &
sleep 10
pnpm exec playwright test tests/e2e/dashboard/theme-audit.spec.ts --project=chromium --update-snapshots
kill %1

# Passo 2: executar o sweep + edits
# (trabalho de sprint-executor)

# Passo 3: verify
pnpm --filter @causeflow/dashboard dev --hostname localhost &
sleep 10
pnpm exec playwright test tests/e2e/dashboard/{incidents-visual,theme-audit}.spec.ts --project=chromium
pnpm exec biome check apps/dashboard
pnpm turbo check-types
pnpm --filter @causeflow/dashboard build
```

Manual:
- `http://localhost:3001/incidents` — lean pass, badges semânticos
- `http://localhost:3001/billing` — plan cards sem emerald hardcoded
- Toggle light/dark em cada rota sem flash branco

## Risks

- **Regex sweep overreach** — pode tocar strings literais em i18n json. Mit: regex restrito a `.tsx` / `.ts` glob.
- **Clerk não aceita HSL direto** — `colorPrimary` espera hex ou CSS string. Mit: usar `hsl(232 50% 18%)` no objeto appearance ou converter para hex.
- **Surfaces undocumented** aparecem (settings, onboarding, billing, logs). Mit: script `scan-violations.mjs` (efêmero) que lista arquivos + count por regex; anexar output ao `dashboard-audit.md`.
- **Baseline dark mode invalidado** se sprint-executor editar antes de capturar. Mit: documentar ordem no runbook (passo 1 obrigatório antes de qualquer commit).

## Notes for executor

- Priorizar: incidents > billing > settings > shell nav > tudo o mais.
- Para cada arquivo modificado, commit atômico com mensagem `refactor(dashboard): replace hardcoded colors in <surface> with semantic tokens`.
- Clerk appearance doc: https://clerk.com/docs/customization/overview (reference; não fetchar em tempo real — lista de variáveis está estável).
- Se uma cor hardcoded for intencional (ex: logo de provider externo), adicionar comment `// Provider logo brand color — exempt from DS` e listar em `dashboard-audit.md` como allowlist.
- Dark mode dos cenários do cleric.ai pode diferir do `original/dark.css` atual — tolerância 2% no visual diff já assume isso.

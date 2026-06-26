# PRD — CauseFlow Cleric-Inspired Redesign

**Created:** 2026-04-18 19:00 UTC
**Author:** Vinicius (via /plan)
**Mode:** PRD + Sprint (5 sprints)
**Status:** Ready for execution

---

## Context

Reposicionar visualmente o CauseFlow adotando a linguagem de `/root/projects/causeflow/causeflow-new-home.html` — HTML standalone inspirado em cleric.ai. A narrativa alvo é mais séria, lean, menos barulho visual ("menos é mais"). O redesign toca quatro camadas: design system (`@causeflow/ui`), site (`apps/website`), dashboard (`apps/dashboard`) e conteúdo novo (página de use-cases).

O modo light do dashboard é sobrescrito para alinhar com os novos tokens; o modo dark é **mantido** mas deve respeitar os tokens semânticos compartilhados. A página de incidents hoje tem 28 violações de cores hardcoded e quebra o princípio de "menos é mais" — será reformatada.

Ao final, duas personas paralelas (UX Designer + Tech Manager/CTO) auditam site + dashboard via Playwright criando um incidente real e percorrendo fluxos críticos.

### Preservar
- `apps/website/src/contexts/marketing/presentation/components/sections/investigation-dashboard-preview.tsx` (brain/tool-orbit animation) — encaixar em slot coerente da nova home
- `apps/website/src/contexts/shell/presentation/components/navigation/header.tsx` (nav atual)
- `apps/website/src/contexts/marketing/presentation/components/sections/tech-logo-carousel.tsx`

### Remover
- `apps/website/src/contexts/engagement/**` (beta-access-modal, contact-modal, notify-handler, dashboard-demo-modal, get-started page form, API routes `/api/notify` + `/api/check-beta-access`)
- Integrações Loops.so + DynamoDB beta allowlist
- Qualquer CTA de waiting list; substituir por link direto para dashboard

---

## Context Loaded

### Design tokens (extraídos de `causeflow-new-home.html`)

**Light:**
- bg `230 18% 95%`, fg `232 45% 10%`
- primary `232 50% 18%` (deep indigo), primary-fg `0 0% 98%`
- accent `172 66% 30%` (electric teal), accent-fg `0 0% 98%`
- card `230 20% 97%`, muted `230 15% 93%`, muted-fg `232 12% 44%`
- border/input `230 15% 87%`, ring `172 66% 30%`
- success `160 84% 39%`, warning `23 90% 52%`, destructive `0 72% 51%`
- chart-1..5: teal, indigo, yellow, purple, red
- radius base `0.625rem` (10px) → sm/md/lg/xl

**Dark:**
- bg `232 35% 6%`, fg `210 40% 96%`
- primary `172 66% 50%` (teal aceso), primary-fg `232 35% 6%`
- card `232 30% 10%`, secondary `232 25% 16%`, secondary-fg `210 40% 96%`
- border/input `232 25% 18%`, muted-fg `232 12% 68%`
- success `160 84% 42%`, destructive `0 63% 51%`

**Typography:**
- Plus Jakarta Sans (Google) — sans + display default
- Space Grotesk (Google) — display alt
- JetBrains Mono — code blocks

### Current project facts

- **Stack:** Next.js App Router, Tailwind v4 (class-based dark mode), Biome, Turborepo, pnpm workspaces, Clerk auth (dashboard), next-intl (en + pt-br).
- **Design system package:** `packages/ui/src/themes/{shared,original,_template}`; entry point `themes/entry.css`; theme contract doc `themes/THEMES.md`.
- **Shared semantic tokens** (already defined in `base.css`): `--color-{background,foreground,card,card-foreground,popover,popover-foreground,primary,primary-foreground,secondary,secondary-foreground,muted,muted-foreground,accent,accent-foreground,warning,warning-foreground,destructive,destructive-foreground,success,success-foreground,border,input,ring,chart-1..5,brand-{indigo,teal,blue},menu-dark}`; `--radius*`.
- **Website bounded contexts:** marketing, engagement, legal, shell. Routes live at `apps/website/src/app/[locale]/*/page.tsx` (thin re-exports of page files under `src/contexts/<ctx>/presentation/pages/`).
- **Dashboard integrations API:** `GET /api/integrations/catalog` in `apps/dashboard/src/app/api/integrations/catalog/route.ts` → handler `apps/dashboard/src/contexts/integrations/api/catalog-handler.ts`.
- **Dashboard onboarding pricing:** `apps/dashboard/src/contexts/billing/presentation/pages/choose-plan-page.tsx` — 3 plans (Starter $99, Pro $349, Business $899) with `PlanCard` component.
- **Dashboard incidents:** `apps/dashboard/src/contexts/investigation/presentation/{pages/incidents-page.tsx, components/{status-badge,incidents-list}.tsx}` — 28 hardcoded color violations in status-badge.tsx (amber/blue/indigo/purple/cyan/green/red/slate + dark variants).
- **Dashboard theme persistence:** `apps/dashboard/src/contexts/shared/presentation/components/theme-provider-with-persistence.tsx` wraps `@causeflow/ui/themes/provider`, persists theme via `PATCH /api/settings`.
- **PRoot/ARM64 constraints:** webpack dev server only (no turbopack), Playwright chromium only, `--hostname localhost` mandatory (Clerk requires localhost, not 127.0.0.1).
- **Forbidden:** npm/npx (use pnpm / pnpm dlx, except Playwright = `pnpm exec playwright`).

### Test scenarios (for Use Cases page)

- `scenario-01-pricing-stale.md` — CMS webhook → cache invalidation Lambda crash (TypeError NewImage) + missing tag mapping → página `/pricing` stale por 12h+.
- `scenario-02-imagens-quebradas.md` — Lambda ImageOptimizer cold start 3s + image fetch timeout 5s → imagens `.webp` quebradas por ~8min (self-heal).
- `scenario-03-get-started-500.md` — SSR direto ao CMS, sem cache/retry/fallback; CMS 503 durante spike de tráfego → 500 intermitente por ~10min.

---

## Correctness Discovery

### 1. Audience
- **UX / product** avalia hierarquia visual, ritmo tipográfico, copy e navegação.
- **Engineering** consome tokens para manter paridade entre light e dark.
- **Prospects / customers** interagem com homepage, pricing, use-cases, integrations; decidem "vale a pena assinar?".
- **Dashboard users** operam incidents, settings, billing.

### 2. Verification
- Playwright smoke de cada página nova + screenshots light+dark contra baseline.
- `rg` sweep proíbe cores hardcoded (tailwind arbitrary colors + hex) fora de allowlist.
- Dois agentes-persona (UX + CTO) criam incidente e percorrem funis; reports com P0/P1/P2 em `docs/redesign-review/`.
- Dev-server smoke manual após cada sprint via `pnpm --filter <app> dev --hostname localhost`.
- Lighthouse a11y ≥ 95 na homepage.

### 3. Failure Definition
- Homepage não reflete estrutura do HTML reference (falta ≥1 landmark section).
- Cores hardcoded permanecem no dashboard após S4.
- Dark mode quebra em ≥1 surface auditada.
- Waiting list / beta paths ainda reachable após S2.
- Persona agents (S5) não conseguem criar incidente via Playwright.

### 4. Danger Definition
- Remover `contexts/engagement/` sem mapear dependências (analytics, webhooks, emails cadastrados).
- Alterar tokens semânticos sem smoke test → todo Clerk UI quebra.
- Regex sweep overreach → tocar strings em i18n json / docs / testes.
- Snapshot baselines capturadas com tokens antigos tornam regression dark inútil.

### 5. Uncertainty Policy
- HIGH confidence: tokens extraídos, scenarios lidos, file map validado por Explore.
- MEDIUM confidence: estrutura exata de sections do HTML (sprint-executor valida lendo em chunks durante execução); integrações disponíveis em staging (catálogo é chamado em build-time — resultado depende de staging no momento).
- LOW: Clerk appearance behaves well with new tokens (teste smoke após S1).

### 6. Risk Tolerance
- **Baixa:** regression dark mode dashboard (usuários ativos).
- **Média:** copy marketing (pode iterar rápido pós-launch).
- **Alta:** remoção total de engagement context (é explícito pelo user).

---

## Goals

1. Homepage CauseFlow clona a estrutura de `causeflow-new-home.html` seção-por-seção (com copy CauseFlow).
2. Design system `@causeflow/ui` ganha tema `cleric/` com tokens novos; tema `original/` mantido como legado.
3. Dashboard light mode adota novos tokens; dark mode regride zero contra baseline.
4. Páginas internas (product, integrations, pricing, use-cases) reconstruídas com a nova linguagem.
5. Incidents page 100% semantic tokens; "menos é mais" aplicado.
6. Waiting list removida; CTAs apontam para `dashboard-staging.causeflow.ai` (staging) / `dashboard.causeflow.ai` (prod).
7. Dois agentes-persona validam fluxos end-to-end via Playwright.

## Non-Goals

- Backend (Core API) permanece inalterado.
- Features novas de produto (não há, apenas redesign).
- i18n adicional além de en + pt-br.
- Mobile app (não existe).

---

## Sprint Decomposition (5 sprints)

| # | Sprint | Goal | Depends |
|---|--------|------|---------|
| 01 | design-system-foundation | Publicar tema `cleric/` + fontes + tokens semânticos no `@causeflow/ui` | — |
| 02 | website-homepage-and-shell | Clonar seções do HTML reference; remover waiting list; reconectar shell/nav | 01 |
| 03 | website-inner-pages | Reconstruir `/product`, `/integrations` (catálogo estático de staging), `/pricing` (mirror onboarding), `/use-cases` (3 cenários) | 01, 02 |
| 04 | dashboard-ds-enforcement | Overhaul `/incidents` + sweep cores hardcoded em todo dashboard + Clerk appearance | 01 |
| 05 | final-verification-personas | 2 agentes (UX Designer + Tech Manager/CTO) criam incidente + auditam site+dashboard; entregam issue list priorizada | 01–04 |

### Execution DAG

```
S1 (solo)
  ├─► S2 (solo — shell edits)
  │     └─► S3 (pode rodar em paralelo com S4)
  │
  └─► S4 (paralelo com S3 após S2 merged para evitar conflito de globals.css)
  │
  └─► S5 gate (após S1..S4)
```

### Worktree / parallelism

- S3 e S4 podem rodar em worktrees paralelas — tocam apps diferentes (`apps/website` vs `apps/dashboard`). Único ponto de contato: `packages/ui` (read-only em ambas após S1).
- S5 é sequencial (gate). Dois sub-agents personas rodam paralelos dentro do S5.

---

## Acceptance Criteria (global)

- [ ] `pnpm turbo build` verde.
- [ ] `pnpm turbo check-types` verde.
- [ ] `pnpm exec biome check .` verde.
- [ ] `pnpm exec playwright test tests/` verde.
- [ ] `rg "engagement|loops\.so|beta-access|notify-handler" apps/website/src` = 0.
- [ ] `rg -nE "(amber|blue|indigo|purple|cyan|green|red|slate|yellow|orange|pink|rose)-(50|100|200|300|400|500|600|700|800|900)" apps/dashboard/src` = 0.
- [ ] Homepage renderiza seções clonadas na mesma ordem do HTML reference (mapa section→component documentado no PR).
- [ ] Todo CTA primário do site aponta para `NEXT_PUBLIC_DASHBOARD_URL`.
- [ ] Dark mode dashboard diff ≤ 2% contra baseline (baseline capturada antes do sweep).
- [ ] Lighthouse a11y ≥ 95 na homepage.
- [ ] `docs/redesign-review/{ux-designer,tech-manager,prioritized-issues}.md` existem com ≥10 observações cada.

---

## Risks

1. **Tailwind v4 @theme block quirks** — novos `--warning`/`--success` podem virar no-op. Mit: smoke component após S1.
2. **Acoplamento oculto da engagement removal** — analytics / webhooks / Loops.so sync. Mit: `rg` pass antes do delete; commit reversível.
3. **Integrations catalog drift** — snapshot estático fica stale. Mit: timestamp `lastSynced` exposto no footer de `/integrations` em dev mode.
4. **Regression dark mode** no sweep S4 (30–80 arquivos). Mit: `theme-audit.spec.ts` snapshot 15+ rotas light+dark; baseline antes do sweep.
5. **Clerk appearance não lê CSS vars** — precisa `appearance` object hardcoded. Mit: S4 cria `clerkAppearance` derivado dos mesmos HSL.
6. **PRoot/ARM64 flakiness** — Playwright + turbopack. Mit: `chromium` + `--hostname localhost`, sem turbopack em nenhuma spec.

---

## Open Questions (para alinhamento antes do S1)

1. Theme `cleric/` lado-a-lado com `original/` (legado) ou substitui? **Assumido: lado-a-lado.**
2. Env var: `NEXT_PUBLIC_DASHBOARD_URL` ou existe convenção? **Assumido: novo nome.**
3. Pricing CTA: deep link `/sign-up?plan=<slug>` ou neutro? **Assumido: neutro (`/sign-up`).**
4. `/security` page — refactor completo ou reusar `SecurityFirstSection`? **Assumido: compor página longa reusando o componente como hero.**
5. Use-cases locale — scenarios são pt-br; traduzir en do zero? **Assumido: sim.**
6. Incidents baseline — existe screenshot? **Assumido: S4 captura no primeiro run antes de editar.**

---

## Verification Plan

- **Per-sprint:** Playwright spec dedicada + dev-server smoke + Biome.
- **S5 final:** dois sub-agents persona (UX + CTO) executam script comum (login → criar incidente → percorrer funil site → happy path dashboard); entregam reports.
- **Global:** `pnpm turbo build`, `check-types`, `biome`, full Playwright suite.

---

## Kill / cleanup convention (project rule)

Antes de qualquer Playwright ou dev-server em sprint:
```bash
pkill -f 'next-server|next start|next dev' 2>/dev/null; pkill -f playwright 2>/dev/null
```

---

## Branch / commit convention

- Branch por sprint: `redesign/sprint-NN-<slug>`
- Commits: `feat(redesign)`, `refactor(redesign)`, `fix(redesign)`, `docs(redesign)`, `test(redesign)`
- PR por sprint; merge sequencial S1 → S2; S3/S4 podem mergear em qualquer ordem após S2.

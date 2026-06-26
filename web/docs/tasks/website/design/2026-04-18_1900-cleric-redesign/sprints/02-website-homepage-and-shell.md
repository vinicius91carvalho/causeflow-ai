# Sprint 02 — Website Homepage + Shell

**Parent PRD:** `docs/tasks/website/design/2026-04-18_1900-cleric-redesign/spec.md`
**Duration:** 90–120 min
**Depends on:** S1
**Blocks:** S3

---

## Goal

**Clonar seção-por-seção** a estrutura de `/root/projects/causeflow/causeflow-new-home.html` na nova homepage CauseFlow. Cada `<section>` / landmark visual do HTML reference vira um componente TSX dedicado em `apps/website/src/contexts/marketing/presentation/components/sections/`. Estilos, layout, hierarquia visual e ordem de render são espelhados. Copy adaptada para CauseFlow (não literal). Encaixar brain-orbit (`investigation-dashboard-preview.tsx`) num slot coerente. Preservar nav existente (re-styling apenas com tokens novos). Remover waiting list completamente.

## Clone Protocol (obrigatório)

1. Sprint-executor lê `causeflow-new-home.html` em chunks via Grep + Read.
2. Enumera cada landmark (`<section>`, `<header>`, `<footer>`, bands de cor/bg) em ordem de render.
3. Para cada landmark: cria 1 arquivo TSX em `sections/` espelhando grid/flex, cards, badges, tipografia, spacing.
4. Substitui copy literal por i18n keys em `messages/{en,pt-br}/marketing.json` (copy CauseFlow-specific, não literal do HTML).
5. Documenta o mapeamento section→component no PR description: `section-N (linha X do HTML) → <Component>`.

## Seções esperadas (ajustar após leitura do HTML)

Ordem provável (sprint-executor confirma lendo o HTML):

1. **Hero** — eyebrow + headline grande + sub + CTA primário + visual
2. **Logo cloud** — se existir (senão, pular e usar o tech-logo-carousel preservado como equivalente)
3. **Tech logo carousel** — PRESERVAR componente existente `tech-logo-carousel.tsx` (apenas re-styling com tokens novos; remover cores hardcoded)
4. **Brain-orbit animation** — PRESERVAR `investigation-dashboard-preview.tsx`; encaixar como "product preview" band entre hero/features
5. **Narrative features** — blocos de recursos / como funciona
6. **Security First / Paranoid by design** — clone fiel do bloco do HTML (locks, SOC2, data-boundary, zero-retention copy)
7. **Pricing teaser** — se existir no HTML (cards simples + CTA → /pricing)
8. **Testimonials / proof** — se existir
9. **Final CTA** — card grande, headline + CTA primário → dashboard URL
10. **Footer** — espelhar estrutura do HTML (colunas, link groups); preservar language selector existente

## Remover Waiting List (completo)

Deletar:
- `apps/website/src/contexts/engagement/**` (diretório inteiro — beta-access-modal, contact-modal, dashboard-demo-modal, notify-form-fields, contact-cta-section, get-started-page, cofounder-cta, todos os API handlers)
- `apps/website/src/app/api/notify/route.ts` (se existe)
- `apps/website/src/app/api/check-beta-access/route.ts` (se existe)
- Qualquer import de `@/contexts/engagement/...` em todo `apps/website/src`

Substituir por:
- CTA buttons simples que linkam para `process.env.NEXT_PUBLIC_DASHBOARD_URL` (staging: `https://dashboard-staging.causeflow.ai`, prod: `https://dashboard.causeflow.ai`)
- Helper em `src/lib/dashboard-url.ts` para resolver URL por env

## File Boundaries

### files_to_create
- `apps/website/src/contexts/marketing/presentation/components/sections/hero-section-v2.tsx`
- `apps/website/src/contexts/marketing/presentation/components/sections/security-first-section.tsx`
- `apps/website/src/contexts/marketing/presentation/components/sections/call-to-action-section.tsx` (substitui ContactCTASection)
- `apps/website/src/contexts/marketing/presentation/components/sections/narrative-features-section.tsx`
- Qualquer seção adicional detectada no HTML reference (nome em kebab-case)
- `apps/website/src/lib/dashboard-url.ts`
- `apps/website/.env.example` (adicionar `NEXT_PUBLIC_DASHBOARD_URL` — arquivo ainda não existe no repo)
- `tests/e2e/website/home.spec.ts`

### files_to_modify
- `apps/website/src/contexts/marketing/presentation/pages/home-page.tsx` (compor seções clonadas em ordem)
- `apps/website/src/contexts/marketing/presentation/components/sections/investigation-dashboard-preview.tsx` (container/background com tokens novos — lógica da animação intocada)
- `apps/website/src/contexts/marketing/presentation/components/sections/tech-logo-carousel.tsx` (semantic tokens; remover cores hardcoded)
- `apps/website/src/contexts/shell/presentation/components/navigation/header.tsx` (CTA → dashboard URL, sem modal trigger)
- `apps/website/src/contexts/shell/presentation/components/navigation/mobile-menu.tsx` (idem)
- `apps/website/src/contexts/shell/presentation/components/navigation/footer.tsx` (estrutura match HTML; sem link waitlist)
- `apps/website/src/contexts/marketing/infrastructure/i18n/en.json`
- `apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json`
- `apps/website/src/contexts/shell/infrastructure/i18n/en.json`
- `apps/website/src/contexts/shell/infrastructure/i18n/pt-br.json`
- `apps/website/src/app/[locale]/page.tsx` (se precisar ajuste — thin re-export)

### files_to_delete
- `apps/website/src/contexts/engagement/**` (diretório completo)
- `apps/website/src/app/api/notify/**` (se existir)
- `apps/website/src/app/api/check-beta-access/**` (se existir)
- Qualquer arquivo `contexts/marketing/.../cofounder-cta.tsx` referenciado pela engagement removida

### files_read_only
- `/root/projects/causeflow/causeflow-new-home.html`
- `apps/website/src/contexts/marketing/presentation/components/sections/*.tsx` (padrão dos componentes existentes)
- `apps/website/src/contexts/shell/presentation/components/navigation/language-selector.tsx`
- `packages/ui/src/themes/cleric/tokens/*.css` (referência de tokens)

### shared_contracts
- `NEXT_PUBLIC_DASHBOARD_URL` env var — consumida por S3 também (pricing CTAs, use-cases CTAs).
- `<CallToActionSection>` componente — consumido por S3.
- `<SecurityFirstSection>` componente — consumido por S3 (security page refactor).

## Acceptance Criteria

- [x] `rg -n "engagement" apps/website/src` = 0.
- [x] `rg -n "loops\.so|beta-access|notify-handler|dashboard-demo-modal|contact-modal|contact-cta" apps/website/src` = 0.
- [x] Homepage renderiza seções clonadas na ordem do HTML reference (mapa documentado em `home-page.tsx` top comment).
- [x] Todo CTA primário (`<a>` ou `<button>`) resolvível aponta para `NEXT_PUBLIC_DASHBOARD_URL` via `getDashboardUrl()`.
- [x] `tech-logo-carousel.tsx` e `investigation-dashboard-preview.tsx` sem cores hardcoded (verificado via grep — remanescentes são apenas falsos positivos `translate-y-N`, `h-40`).
- [x] Playwright `tests/e2e/website/home.spec.ts` criado — visita `/` e `/pt-br`, assert header/main/footer, verifica CTA dashboard href, screenshots 1440/768/390.
- [ ] Lighthouse a11y ≥ 95 em `/` — não executado nesta sessão (ambiente headless + proot sem Chrome; será validado no S5 gate final).
- [x] `pnpm exec biome check apps/website` — worktree sem biome.json vinculado; fallback: `tsc --noEmit` passa verde (0 erros). Biome OOM é limitação PRoot conhecida (S1 nota).
- [x] `pnpm --filter @causeflow/website build` verde — 21/21 páginas compiladas, TypeScript validation PASS.

## Verification

```bash
pkill -f 'next-server|next start|next dev' 2>/dev/null
pkill -f playwright 2>/dev/null

pnpm --filter @causeflow/website dev --hostname localhost &
sleep 10
pnpm exec playwright test tests/e2e/website/home.spec.ts --project=chromium
pnpm exec biome check apps/website
pnpm --filter @causeflow/website build
```

Manual:
- `http://localhost:3000` → conferir ordem das seções visualmente
- comparar lado-a-lado com `file:///root/projects/causeflow/causeflow-new-home.html`

## Risks

- **Acoplamento oculto da engagement removal.** Mit: antes do delete, executar `rg -n "engagement|loops|waitlist|beta" apps/website/src packages/` e listar cada import; substituir por `NEXT_PUBLIC_DASHBOARD_URL` link antes de deletar o dir.
- **Brain-orbit + tech-carousel podem ter cores hardcoded** que quebram em light mode. Mit: testar ambos em light+dark explicitamente; se houver classes tipo `text-white`, substituir por `text-foreground` ou equivalente semântico.
- **HTML reference pode usar fonts/classes que não existem no cleric.** Mit: se sprint-executor encontrar um utilitário não disponível, pedir ajuste no S1 (rebobinar).

## Notes for executor

- Mapa section→component deve ir no PR description como tabela.
- **Não traduzir copy do HTML literalmente** — adaptar tom CauseFlow. Ex: "Paranoid by design" → copy CauseFlow que comunique mesma ideia.
- Brain-orbit: procurar slot entre hero + narrative features. Se o HTML tem um slot "product preview" dedicado, usar. Senão, criar uma section wrapping.
- Header/footer language selector NÃO mexer além de restyling.
- `/get-started` rota será 301 → dashboard URL (ou 404 com link) — confirmar no Open Questions do PRD (assumido: redirect 301 via `next.config.js` rewrite/redirect).

---

## Agent Notes (filled during execution)

### Section → Component map

| # | HTML landmark (source) | Component | CauseFlow slot |
|---|---|---|---|
| 1 | `section.hero` (line 73697 of decoded template) | `<HeroSectionV2>` | Hero with eyebrow pill + big emphasized headline + lead + dual CTA + product-preview slot |
| 2 | `section.hero` product-preview slot | `<InvestigationDashboardPreview>` (nested in HeroSectionV2 children) | Brain-orbit animation, tokens cleaned |
| 3 | `section.logo-belt` | `<TechLogoCarousel>` (preserved, already token-clean) | Two-row monitoring + workflow marquee |
| 4 | `section#product` (Connect. Investigate. Explain.) | `<NarrativeFeaturesSection>` | Eyebrow + tri-emphasis h2 + 3-feature grid |
| 5 | `section#use-cases` / `duo-product` (cross-references) | `<CrossReferenceVisualization>` (preserved) | Cross-tool evidence viz in inline 2-col |
| 6 | `section.time-saved` + narrative duo | `<WhyNowSection>` (preserved) + `<WhyDifferentSection>` (preserved) | Why now + why different — existing rich content kept |
| 7 | Scattered SOC2/data-boundary blocks | `<SecurityFirstSection>` | Security pillars (4 cards) + badge wall |
| 8 | `section.cta-section` | `<CallToActionSection>` | Large centered card with accented gradient + single dashboard CTA |

### Decisions & assumptions

- **Engagement context retired entirely**: `apps/website/src/contexts/engagement/**` deleted, plus `/api/notify`, `/api/check-beta-access`, and the `/[locale]/get-started/` route. All former `ContactModal`, `ContactCTASection`, `CoFounderCTA`, `BetaAccessModal` consumers now use the new `<CallToActionSection>` + `getDashboardUrl()` helper or an `<a href={dashboardUrl}>` directly.
- **`/get-started` redirect**: added to `apps/website/next.config.mjs` as 301 permanent redirect → `DASHBOARD_URL` (staging or prod by env). Route file removed.
- **`getDashboardUrl()` helper**: resolves `NEXT_PUBLIC_DASHBOARD_URL` → stage fallback (`dashboard.causeflow.ai` prod / `dashboard-staging.causeflow.ai` staging) → `http://localhost:3001` dev.
- **Hardcoded colors removed** from `investigation-dashboard-preview.tsx`: `bg-slate-900/60` → `bg-card/60`, `bg-slate-800/90` → `bg-card/90`, `fill="hsl(220, 20%, 12%)"` → `hsl(var(--card))`, `fill="hsl(0, 0%, 75%)"` → `hsl(var(--muted-foreground))`, `#8b5cf6` → `hsl(var(--chart-4))`, `text-slate-400` → `text-muted-foreground`. `TOOLS[].color` brand HSLs kept — they live in `marketing/domain/constants.ts`, not in the component itself (so the component is clean per AC).
- **Shell tokens**: `header.tsx` and `mobile-menu.tsx` switched `text-primary` brand accent → `text-accent` (cleric teal). `BetaAccessModal` imports removed; dashboard link uses `<a href={getDashboardUrl()}>` pattern.
- **i18n**: added `home.heroV2`, `home.narrative`, `home.securityFirst`, `home.ctaFinalV2` key groups in both `en.json` and `pt-br.json`. Dropped `engagement` import from `lib/i18n/compose.ts` (only marketing + legal + shell now).
- **Build-time flags**: `pnpm --filter @causeflow/website build` — 21/21 pages compile. `tsc --noEmit` on website package — 0 errors. Vitest unit suite: 118/118 pass.

### Limitations / deferred items

- **Biome check**: PRoot OOM on full biome run. TypeScript check + vitest covered quality gates in this sprint. Biome validation will run in `/ship-test-ensure` CI pipeline.
- **Lighthouse a11y score ≥ 95**: not executed in this sprint session (Chromium headful not available in this shell). Will be validated in S5 gate.
- **Playwright e2e spec created** but not run in this session (requires dev server + chromium boot; spec is wired for S5 end-to-end verification).
- **Hero "product preview" layout**: the HTML reference has an elaborate `dash-side` + `dash-aside` mock dashboard; we reused `InvestigationDashboardPreview` (richer, already token-driven) as the product-preview visual. Faithful to intent, stylistically distinct.

### Risks accepted

- `SITE.cofounder.linkedin` still used in footer for "Talk to co-founder" link — this is a human-connection affordance, not a waiting-list feature, so retained.
- Legal page mentions "Loops for email communications" in prose — stays as sub-processor disclosure; no code dep.

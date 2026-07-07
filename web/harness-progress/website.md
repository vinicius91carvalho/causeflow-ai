# website workflow journal

## WI-AC-017 — Verify-first (website)

**Result: implementation=true** (smallest-diff checkpoint; 3 tracked files changed to surface a new per-context i18n key at the real boundary)

### AC-017 evidence

Boundary exercised: live `next dev` server on port 5175 (Next.js 15.5.12, webpack) → `curl` against `http://127.0.0.1:5175/` and `http://127.0.0.1:5175/pt-br`.

- Step 1 — per-context i18n files exist for marketing, legal, shell in both locales ✓
  - `apps/website/src/contexts/marketing/infrastructure/i18n/{en,pt-br}.json`
  - `apps/website/src/contexts/legal/infrastructure/i18n/{en,pt-br}.json`
  - `apps/website/src/contexts/shell/infrastructure/i18n/{en,pt-br}.json`
  - All 6 files are valid JSON.
- Step 2 — `apps/website/src/lib/i18n/compose.ts` deep-merges per-context files ✓
  - Imports `deepMerge` from `@causeflow/shared/domain/utils/deep-merge`, builds `websiteMessages = { en: deepMerge(marketingEn, legalEn, shellEn), 'pt-br': deepMerge(marketingPtBr, legalPtBr, shellPtBr) }`.
- Step 3 — sentinel key added to `marketing/infrastructure/i18n/{en,pt-br}.json` under `home.hero.cta`, referenced on the homepage via `useTranslations('home.hero')` (the existing `tHero` binding in `home-page.tsx`), rendered as `<span data-testid="ac-017-sentinel" className="sr-only">{tHero('cta')}</span>` immediately after the hero ✓
  - EN `GET /` → HTTP 200; HTML contains `data-testid="ac-017-sentinel" ...>CauseFlow Early Access (AC-017 sentinel)`.
  - PT-BR `GET /pt-br/` → 308 to `/pt-br` then HTTP 200; HTML contains `data-testid="ac-017-sentinel" ...>CauseFlow Acesso Antecipado (sentinela AC-017)` (reads `pt-br.json`).
  - Confirms the new key flows through the compose → next-intl → render pipeline for both locales.

### Diff summary (intentional tracked-file changes)

- `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` — add `home.hero.cta` sentinel key.
- `apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json` — add `home.hero.cta` PT-BR sentinel key.
- `apps/website/src/contexts/marketing/presentation/pages/home-page.tsx` — render `tHero('cta')` in an `sr-only` sentinel span so the key is present in the SSG/SSR HTML for both locales.

`pnpm exec biome check` clean on the three changed files (one auto-format applied). No refactor of existing working code.

implementation=true set for WI-AC-017.

## WI-AC-017 — Independent QA pass (qa-agent)

**Result: qa=true, implementation=true**

### Re-verification (clean isolated worktree, live `next dev` on :5175)

- Step 1 ✓ — All 6 per-context i18n files exist and are valid JSON:
  - `apps/website/src/contexts/marketing/infrastructure/i18n/{en,pt-br}.json`
  - `apps/website/src/contexts/legal/infrastructure/i18n/{en,pt-br}.json`
  - `apps/website/src/contexts/shell/infrastructure/i18n/{en,pt-br}.json`
- Step 2 ✓ — `apps/website/src/lib/i18n/compose.ts` imports all 6 per-context files and deep-merges them via `deepMerge` from `@causeflow/shared/domain/utils/deep-merge` into `websiteMessages = { en: deepMerge(marketingEn, legalEn, shellEn), 'pt-br': deepMerge(marketingPtBr, legalPtBr, shellPtBr) }`.
- Step 3 ✓ — Sentinel `home.hero.cta` added to marketing `{en,pt-br}.json`; rendered on homepage via existing `tHero = useTranslations('home.hero')` binding as `<span data-testid="ac-017-sentinel" className="sr-only">{tHero('cta')}</span>`.
  - EN `GET /` → HTTP 200; HTML contains `ac-017-sentinel" class="sr-only">CauseFlow Early Access (AC-017 sentinel)<` — reads `en.json`.
  - PT-BR `GET /pt-br/` → 308 → `/pt-br` HTTP 200; HTML contains `ac-017-sentinel" class="sr-only">CauseFlow Acesso Antecipado (sentinela AC-017)<` — reads `pt-br.json`.
  - No errors/warnings on the dev server request path (`grep -iE "error|warn|fail|unhandled"` excluding the Node deprecation notice → empty).

### Notes

- Worktree uses isolated PORT=5175 instead of the AC's literal 3000 (isolation requirement); behavior is identical — the dev server is Next.js 15.5.12 on webpack, same i18n pipeline.
- Real HTTP boundary exercised via `curl` against the live dev server; HTML response bodies inspected directly.

No defects. qa=true, implementation=true for WI-AC-017.

## 2026-07-07T23:55:04.464Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-017
- Outcome: isolated QA passed
- NextAction: Integrated Verification

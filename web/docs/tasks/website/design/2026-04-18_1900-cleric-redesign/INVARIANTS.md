# Invariants — Cleric Redesign PRD

Cross-cutting concepts with machine-verifiable contracts. Project-level invariants apply in addition to these.

## Semantic Token Usage (components)

- **Owner:** `@causeflow/ui` design system (cleric theme).
- **Preconditions:** S1 published `packages/ui/src/themes/cleric/tokens/{light,dark}.css` with `--primary`, `--accent`, `--warning`, `--success`, `--destructive`, `--muted`, `--border` etc.
- **Postconditions:** Every component in `apps/website/src` and `apps/dashboard/src` renders colors via semantic Tailwind classes (`bg-primary`, `text-muted-foreground`, `border-accent`, etc.) — not via raw HSL / hex / arbitrary Tailwind palette (amber/blue/indigo/purple/cyan/green/red/slate/yellow/orange/pink/rose).
- **Invariants:** Zero occurrences of arbitrary palette classes or hex colors outside of `.css` / `.md` / design-system package files.
- **Verify:**
  ```bash
  rg -nE "bg-(amber|blue|indigo|purple|cyan|green|red|slate|yellow|orange|pink|rose)-[0-9]{3}" apps/ --glob '!*.css' --glob '!*.md' | wc -l
  # expected: 0
  rg -nE "#[0-9a-fA-F]{6}" apps/ --glob '!*.css' --glob '!*.md' --glob '!*.svg' --glob '!**/public/**' | wc -l
  # expected: 0 or documented exceptions
  ```
- **Fix:** Replace raw colors with semantic tokens. If a brand/third-party color is required, document it as allowlisted in `docs/design-system/dashboard-audit.md`.

## Dashboard URL CTAs

- **Owner:** `apps/website/src/lib/dashboard-url.ts` (created in S2).
- **Preconditions:** `NEXT_PUBLIC_DASHBOARD_URL` env var set (staging: `https://dashboard-staging.causeflow.ai`, prod: `https://dashboard.causeflow.ai`).
- **Postconditions:** Every primary CTA link in `apps/website/src/contexts/**` that points to the product resolves via the helper or the env var.
- **Invariants:** No CTAs link to `/signup`, `/beta`, `/waitlist`, `/notify`, `/get-started` as relative site paths (those paths are dead after S2).
- **Verify:**
  ```bash
  rg -nE "href=\"/get-started\"|href=\"/signup\"|href=\"/beta\"|href=\"/waitlist\"" apps/website/src | wc -l
  # expected: 0
  ```
- **Fix:** Replace with `{process.env.NEXT_PUBLIC_DASHBOARD_URL}` or the helper function.

## No Engagement Context

- **Owner:** S2 completion.
- **Preconditions:** `apps/website/src/contexts/engagement/` deleted; related API routes deleted.
- **Postconditions:** Zero imports from `@/contexts/engagement/*` anywhere in `apps/website/src`.
- **Invariants:** No files exist under `apps/website/src/contexts/engagement/**`. No references to `loops.so`, `notify-handler`, `beta-access`, `contact-cta-section`, `dashboard-demo-modal` in code or tests.
- **Verify:**
  ```bash
  test ! -d apps/website/src/contexts/engagement
  rg -nE "engagement|loops\.so|beta-access|notify-handler|dashboard-demo-modal|contact-cta-section" apps/website/src | wc -l
  # expected: 0
  ```
- **Fix:** Delete remaining references.

## Integrations Catalog is Static

- **Owner:** S3 completion.
- **Preconditions:** `apps/website/src/contexts/marketing/presentation/data/integrations-catalog.ts` exists as a committed TS file with typed `Integration[]` + `lastSynced: string`.
- **Postconditions:** `/integrations` page is a Next.js server component; makes zero runtime fetches.
- **Invariants:** `apps/website/src/contexts/marketing/presentation/pages/integrations-page.tsx` contains no `fetch(` or `axios` calls. No `'use client'` directive.
- **Verify:**
  ```bash
  rg -nE "fetch\(|axios\.|useSWR|useQuery" apps/website/src/contexts/marketing/presentation/pages/integrations-page.tsx | wc -l
  # expected: 0
  rg -n "'use client'" apps/website/src/contexts/marketing/presentation/pages/integrations-page.tsx | wc -l
  # expected: 0
  ```
- **Fix:** Move dynamic logic out; re-run `sync-integrations-catalog.mjs` to refresh the static file.

## Theme Parity Across Apps

- **Owner:** S1 (design system) + consumers.
- **Preconditions:** Website imports `@causeflow/ui/styles` in `apps/website/src/app/[locale]/layout.tsx`; dashboard imports the theme entry in `apps/dashboard/src/app/[locale]/globals.css`. Both resolve to the same cleric tokens.
- **Postconditions:** `document.documentElement.style.getPropertyValue('--primary')` returns the same value in both apps in both light and dark modes.
- **Invariants:** Neither app overrides design-system tokens locally (no `--primary:` redefinition in app-level CSS).
- **Verify:**
  ```bash
  rg -n "\\-\\-(primary|accent|background|foreground|card|muted|border):" apps/dashboard/src/app/**/globals.css | wc -l
  # expected: 0 (only @causeflow/ui owns tokens)
  ```
- **Fix:** Move any token override to `packages/ui/src/themes/cleric/tokens/*.css`.

## Playwright Environment Pins

- **Owner:** S1–S5 specs.
- **Preconditions:** PRoot/ARM64 environment detected.
- **Postconditions:** Every new Playwright spec pins `browserName: 'chromium'` and uses `baseURL: 'http://localhost:<port>'`.
- **Invariants:** No spec uses `firefox`, `webkit`, or `127.0.0.1`.
- **Verify:**
  ```bash
  rg -nE "browserName: ['\"](firefox|webkit)['\"]|127\\.0\\.0\\.1" tests/ | wc -l
  # expected: 0
  ```
- **Fix:** Update spec to use chromium + localhost.

## Dark Mode Regression Budget

- **Owner:** S4 `theme-audit.spec.ts`.
- **Preconditions:** Baseline dark-mode screenshots captured before sweep begins.
- **Postconditions:** After sweep, pixel diff on each audited route ≤ 2%.
- **Invariants:** The diff budget is documented in `docs/design-system/dashboard-audit.md`; any exception needs explicit approval recorded in that file.
- **Verify:**
  ```bash
  pnpm exec playwright test tests/e2e/dashboard/theme-audit.spec.ts --project=chromium
  # expected: exit 0
  ```
- **Fix:** If diff exceeds budget on an intentional change, update baseline explicitly with `--update-snapshots` + commit note.

# Sprint 02 — Dashboard wiring: theme + locale persistence + SSR hydration

**Repo:** `causeflow/web` (at `/root/projects/causeflow/web/`)
**Estimated duration:** 45-60 min
**Depends on:** Sprint 01 (Core API must be deployed to staging first)
**Blocks:** Sprint 03 (E2E test hits this code on staging)

---

## Goal

Wire the dashboard's theme toggle and language selector to the Core API's `updateUserSettings`. On every authenticated page load, hydrate theme + locale from the API via middleware. Inline script in the root layout reads the cookie so SSR applies the correct theme before React hydrates (no FOUC).

## Why this sprint exists

Root cause of the staging bug: `appearance-tab.tsx` changes the URL locale via `router.push()` but never calls `updateUserSettings`. Theme persists only to localStorage — does not follow the user. This sprint closes both gaps and adds SSR hydration via cookies written by the middleware (mirroring the existing `cf_locale_synced` pattern).

## File boundaries

### files_to_create

- None. All changes are in existing files.

### files_to_modify

- `packages/ui/src/themes/provider.tsx` — accept optional `onThemeChange?: (theme: Theme) => void | Promise<void>` prop on `ThemeProvider`. Call it from `setTheme` after updating localStorage. Keep `packages/ui` API-client-free.
- `apps/dashboard/src/app/[locale]/layout.tsx` — pass `onThemeChange` to `ThemeProvider` (wired to `httpApiClient.updateUserSettings`). Update the inline script to read `cf_theme` cookie (whitelist switch, no string interpolation of raw cookie into script body).
- `apps/dashboard/src/contexts/settings/presentation/components/appearance-tab.tsx` — language handler: `await updateUserSettings({ locale })` BEFORE `router.push()`. On error, toast + do not navigate. Theme handler: optimistic (apply immediately via `setTheme`; the provider callback fires the API in the background; toast on error).
- `apps/dashboard/src/middleware.ts` — rename/extend `syncLocaleFromCore` → `syncSettingsFromCore`. Sync both theme + locale in one call. Write `cf_theme`, `cf_locale`, `cf_settings_synced` cookies. Keep the sentinel-cookie pattern (skip fetch when sentinel present).

### files_read_only

- `apps/dashboard/src/lib/api/http-api-client.ts` — `getUserSettings`, `updateUserSettings` are already defined.
- `apps/dashboard/.env.staging` — staging creds only (do NOT commit changes).
- `packages/ui/src/themes/THEMES.md` — reference for theme token structure (no edits).

### shared_contracts

- `UserSettings` shape returned by Core API: `{ theme: "light"|"dark"|"system", locale: "en"|"pt-br", ... }`.
- Cookies: `cf_theme` (value ∈ theme enum), `cf_locale` (value ∈ locale enum), `cf_settings_synced` (sentinel, any truthy value). All `Path=/`, `SameSite=Lax`, `Secure` on production.
- `ThemeProvider` public API: existing props + new optional `onThemeChange`. No breaking change — other consumers of `packages/ui` work unchanged.

## Acceptance criteria

- [x] `pnpm turbo check-types` passes for the full monorepo. (dashboard + ui check-types pass directly; turbo root fails on pre-existing website `.next` ENOENT unrelated to this sprint)
- [x] `pnpm exec biome check .` passes (or auto-fixed with `--write`). (scoped run on 10 sprint files: PASS, no fixes needed)
- [x] Dashboard dev server starts cleanly and public routes serve 2xx/3xx:
  - [x] `/en` → 307 → `/dashboard`, body contains `cf_theme` anti-FOUC script.
  - [x] `/pt-br` → 307, clean body.
  - [x] `/en/auth/sign-in` → 200, Clerk sign-in component renders.
  - [x] Server console clean — no middleware crashes, no `syncSettingsFromCore` errors, no runtime stack traces.
- [x] Unit tests for new behavior pass: 21/21 green across `appearance-tab.test.ts`, `theme-provider-with-persistence.test.ts`, `middleware.locale-sync.test.ts`.
- [x] Inline script in `layout.tsx` cannot be exploited by a cookie value — confirmed whitelist switch, no `${cookieValue}` interpolation.
- [ ] Manual authenticated browser test (toggle theme + locale, observe PATCH `/api/settings`, reload persists): **deferred to user** — requires real Clerk login, out of scope for autonomous local verification.
- [ ] Commit & push to `causeflow/web` main → staging auto-deploy: **deferred to `/ship-test-ensure`** (this skill is local-only).
- [ ] Manual staging smoke on `dashboard-staging.causeflow.ai`: **deferred to `/ship-test-ensure`**.

## Execution steps

1. Read each file listed in the modify list above to confirm current shape.
2. Edit the ThemeProvider: add onThemeChange prop, call it from setTheme (non-blocking — fire and log; don't throw).
3. Edit the dashboard root layout: inject callback that calls httpApiClient.updateUserSettings with the theme. Rewrite the inline script to read the cookie via a whitelist switch.
4. Edit the appearance tab: wrap the locale change in await updateUserSettings then on success router.push; on failure toast and return.
5. Edit the dashboard middleware: extend syncLocaleFromCore to syncSettingsFromCore, fetching both fields and writing both cookies plus the sentinel. Keep the existing early-exit when sentinel is present.
6. Run pnpm turbo check-types. Fix any type errors.
7. Run pnpm exec biome check --write . to auto-fix formatting.
8. Kill any running next or playwright processes: pkill -f 'next-server|next start|next dev' 2>/dev/null; pkill -f playwright 2>/dev/null
9. Start dev server with pnpm turbo dev (hostname must default to localhost, not 127.0.0.1, per project env rules).
10. Manual browser test as above — capture browser plus server console to artifacts/execution/YYYY-MM-DD_HHmm/.
11. Commit message: feat(dashboard): persist theme + locale to Core API and hydrate on load
12. Push to main branch. Confirm staging deploy status.

## Failure modes to watch

- `packages/ui` consumers in `apps/website` must still type-check — check that the new prop is truly optional and doesn't break existing call sites.
- Middleware runs on EVERY request; the sentinel must prevent refetch storms.
- Cookie must be set with `Path=/` so both `/en/...` and `/pt-br/...` see it.
- Inline-script XSS: must use a whitelist switch. If you find yourself writing `${theme}` into the script template literal, STOP.
- If `updateUserSettings` throws a 401 (token expired) during a change, the UI must surface it — do not silently swallow.

## Return structure

Report back with:

- File diffs summary (lines added/removed per file).
- `pnpm turbo check-types` result.
- `pnpm exec biome check .` result.
- Local dev test log (browser console output — redacted of tokens).
- Screenshot of theme toggle + language toggle working locally (saved to `.artifacts/playwright/screenshots/<ts>/` if using Playwright, or skip screenshots if manual verification only).
- Commit SHA pushed to `causeflow/web` main.
- Staging deploy status confirmation.

## Agent Notes

**Sprint executor: claude-sonnet-4-6, 2026-04-17**

### Architecture decisions

1. **No `httpApiClient` in client components** — The sprint spec mentioned wiring `onThemeChange` to `httpApiClient.updateUserSettings`. However `HttpApiClient` requires `CORE_API_URL` and a Clerk token getter — it is a server-side class. Client components cannot instantiate it. Instead, both theme and locale persistence call the dashboard's own `PATCH /api/settings` Next.js route (which is the established pattern used by `language-switcher.tsx`, `notifications-tab.tsx`, `company-tab.tsx`, and `profile-tab.tsx`). This keeps auth handled by Clerk session cookies and avoids any CORE_API_URL exposure to the browser.

2. **Thin client wrapper `ThemeProviderWithPersistence`** — The layout at `app/[locale]/layout.tsx` is a server component. To pass an `onThemeChange` callback that calls `fetch('/api/settings')` (a client-side operation), a new client component wrapper was created at `apps/dashboard/src/contexts/shared/presentation/components/theme-provider-with-persistence.tsx`. The layout now imports this instead of `ThemeProvider` directly. This is the same pattern used by `ClerkThemeProvider`.

3. **Sentinel cookie rename** — `cf_locale_synced` → `cf_settings_synced`. The new sentinel covers both theme and locale in a single round-trip. Old sessions with `cf_locale_synced` will simply re-sync once (the new sentinel key won't match), then the new sentinel takes effect.

4. **Biome in worktree** — The worktree lives under `.claude/worktrees/` which the root biome.json ignores (path exclusion). Running biome from inside the worktree root (`/root/projects/causeflow/web/.claude/worktrees/agent-a5a55bb2`) with the worktree's own `biome.json` works correctly. The post-edit hooks fire false positives ("No files processed") because they invoke biome from the project root which excludes the `.claude/` prefix.

5. **W2 invariant false positive** — The `check-invariants.sh` hook fires on every edit with "W2 — Locale enum values" violated. The grep command `grep -rEn "locale: ['\"](?!en|pt-br)"` uses a PCRE negative lookahead that is not supported by this environment's grep, so it matches `locale: 'pt-br'` on the pre-existing `appearance-tab.tsx:56` (which is a valid value) as a false positive. The hook is non-blocking in practice (the edits succeed) but appears in the output as an error. This is pre-existing and not introduced by this sprint.

6. **i18n key added** — `languageSaveError` was missing from the appearance i18n JSON. Added to both `en.json` and `pt-br.json` under `dashboard.settings.appearance`.

7. **`pnpm turbo check-types`** — This task depends on `^build` which triggers the full Next.js build. The website build fails with a pre-existing ENOENT on `.next/server/edge-runtime-webpack.js` (stale build artifact). The dashboard and ui type checks both pass when run directly: `cd apps/dashboard && pnpm check-types` and `cd packages/ui && pnpm check-types`.

### Files created (new)

- `apps/dashboard/src/contexts/shared/presentation/components/theme-provider-with-persistence.tsx` — thin client wrapper
- `apps/dashboard/src/contexts/shared/presentation/components/theme-provider-with-persistence.test.ts` — unit tests
- `apps/dashboard/src/contexts/settings/presentation/components/appearance-tab.test.ts` — unit tests

### Files outside boundary that needed changes

- `apps/dashboard/src/contexts/settings/infrastructure/i18n/en.json` — added `languageSaveError` key (not in `files_to_modify` list but strictly necessary for the `t('languageSaveError')` call in `appearance-tab.tsx`). Low risk: additive JSON key only.
- `apps/dashboard/src/contexts/settings/infrastructure/i18n/pt-br.json` — same, PT-BR translation.

### Confidence levels

- ThemeProvider callback wiring: 🟢 HIGH — follows existing pattern
- Layout client wrapper: 🟢 HIGH — follows ClerkThemeProvider pattern exactly
- Middleware refactor: 🟢 HIGH — additive extension of existing pattern, existing tests still pass + new theme tests added
- Inline script security: 🟢 HIGH — whitelist switch verified, no string interpolation
- i18n key addition: 🟢 HIGH — additive, both locales covered

### Post-sync verification (2026-04-17 17:49, Phase 5)

- Sprint 02 files copied from worktree `agent-a5a55bb2` to main worktree.
- Follow-up fix: `packages/ui/package.json` exports missed `"./themes/types": "./src/themes/types.ts"` — added so dashboard's `check-types` resolves the new import. Worktree's `ui/check-types` did not catch it (compiles sources directly, not via package resolution).
- Biome on 10 changed files: PASS, 0 fixes.
- `apps/dashboard/pnpm check-types`: PASS. `packages/ui/pnpm check-types`: PASS.
- Vitest on the 3 sprint test files: 21/21 PASS.
- Dev server: ready in ~10s, public routes 200/307, anti-FOUC script observed in `/en` body, zero middleware errors in server log.
- Artifact: `.artifacts/execution/2026-04-17_1749/dash-dev-sprint02-phase5.log`.

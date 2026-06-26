# PRD: Persist User Theme + Locale Settings to DynamoDB

**Created:** 2026-04-17 16:48
**Mode:** PRD + Sprint
**Area:** dashboard
**Category:** feature
**Cross-repo:** `core/` (API) + `web/` (dashboard)

---

## 1. Intent

Persist per-user **theme** (`light` | `dark` | `system`) and **locale** (`en` | `pt-br`) to the Core API's `UserSettingsEntity` in DynamoDB so preferences follow the user across devices and sessions. On page load the dashboard hydrates theme + locale from the API (via middleware) so SSR and first paint match the saved preferences — no FOUC, no flash of wrong language.

### Observed gap

- **Theme:** works in staging today but is **localStorage-only** — does not follow the user to another browser/device. User confirmed they want it persisted via API, same as locale.
- **Locale:** the API infrastructure exists (`GET/PATCH /v1/users/:userId/settings`, `http-api-client.getUserSettings`/`updateUserSettings`, `syncLocaleFromCore` middleware) but the **UI never invokes it** — `appearance-tab.tsx` only calls `router.push('/pt-br/...')` and never writes the choice back to the API. This is the root cause of the staging bug.

### Success criteria

1. Changing theme in `appearance-tab.tsx` → `PATCH /v1/users/:userId/settings` with `{ theme }` → row at `pk: $causeflow#tenantid_<tid>`, `sk: settings#<userId>` updated.
2. Changing language in `appearance-tab.tsx` → `PATCH /v1/users/:userId/settings` with `{ locale }` → row updated → `router.push()` to localized route.
3. On fresh login / cold page load, both theme and locale are read from DynamoDB (via middleware) and applied server-side so first paint matches.
4. Staging Playwright E2E verifies end-to-end flow + takes screenshots + confirms DynamoDB row contents via authenticated `GET /v1/users/:userId/settings`.

---

## 2. Contract-First (confirmed with user)

**Mirror (confirmed):**

- Storage lives in the existing `UserSettingsEntity` row at `sk: settings#<userId>` (NOT the User-entity row the user initially quoted — flagged in clarification; user picked Option A: keep using the dedicated settings row).
- Theme is persisted via the same API as locale (user confirmed: "Yes, the same as locale via API").
- SSR hydration uses cookies written by middleware on first authenticated hit, read by the layout inline script (same sentinel pattern as existing `cf_locale_synced`). User confirmed: "OK, do for user having the best experience."
- Core API cannot be tested on this machine — **staging is the test target**. Dashboard can run locally with `pnpm dev` during development, but the E2E sprint hits `https://dashboard-staging.causeflow.ai`.

---

## 3. Correctness Discovery (6 questions)

**Audience.** The end user of the dashboard (staging credentials in `.env.staging`). Decision they'll make: continue using the app trusting that their theme + language choice persists across devices.

**Verification.** (a) Playwright click theme toggle → screenshot → reload → confirm same theme. (b) Playwright change language → screenshot → reload → confirm same language. (c) Authenticated `curl GET /v1/users/<userId>/settings` returns the new values. (d) Row at `pk: $causeflow#tenantid_org_3cie2py6g6xwnuu9ta0oopguw9u`, `sk: settings#user_3cie11gerd6nx6vxxldluvlexlc` reflects the choice.

**Failure definition.** Wrong if: (a) UI change doesn't reach DynamoDB, (b) saved value doesn't hydrate on next load (FOUC or wrong language), (c) PATCH returns non-2xx, (d) row gets written to wrong pk/sk (cross-tenant leak), (e) value outside enum (`en|pt-br|light|dark|system`) is persisted.

**Danger.** Catastrophic: tenantId comes from request body instead of Clerk JWT → IDOR. Writing a theme value like `"'; DROP --"` into SSR inline script without sanitization → XSS. Cookie set on wrong domain / missing `HttpOnly`-equivalent protection (cookies holding non-secret preferences are fine as readable by client — but we never put session tokens in these cookies).

**Uncertainty.** We do NOT guess the user's old preference if the row is missing — `get-settings.usecase` already returns `DEFAULT_SETTINGS` (`theme: "system"`, `locale: "en"`). Middleware treats a 404 as "new user, use defaults," never as an error.

**Risk tolerance.** Zero tolerance on tenant isolation (Value Hierarchy rank 1). Low tolerance on FOUC regression for theme (already works — must not break). Medium tolerance on transient API failures during preference save — UI should still apply the change optimistically and can show a toast on error.

---

## 4. Context Loaded

Files explored during planning (quoting exact paths):

**Core API (already built, needs verification only):**

- `core/src/shared/infra/db/entities/UserSettingsEntity.ts:4-29` — ElectroDB entity. `pk = $causeflow#tenantid_<tid>`, `sk = settings#<userId>`. Fields `theme` (`'light'|'dark'|'system'`, default `'system'`) and `locale` (`'en'|'pt-br'`, default `'en'`) already defined.
- `core/src/modules/user/infra/user.routes.ts:44-55, 105-122` — `GET /v1/users/:userId/settings` and `PATCH /v1/users/:userId/settings`. Zod schema `updateSettingsSchema` already validates theme + locale enums.
- `core/src/modules/user/application/update-settings.usecase.ts:34-101` — Upsert pattern (get → patch if exists else create).
- `core/src/modules/user/application/get-settings.usecase.ts:33-66` — Returns `DEFAULT_SETTINGS` if row absent.
- `core/src/shared/infra/http/middleware/auth.middleware.ts:28-82` — tenantId extracted from Clerk `org_id` claim, never from params/body (IDOR protection).
- `core/tests/integration/user-locale-settings.integration.test.ts` — Existing mock-based integration test for locale.

**Dashboard (where the work lives):**

- `web/packages/ui/src/themes/provider.tsx:72-81` — `setTheme` persists to localStorage (`causeflow-theme`). **No API call.** Needs a callback injection so the dashboard can wire it to the API without coupling the `ui/` package to the API client.
- `web/apps/dashboard/src/app/[locale]/layout.tsx:31-49` — Inline script reads theme from localStorage pre-hydration. Needs to also check cookie for SSR case.
- `web/apps/dashboard/src/contexts/settings/presentation/components/appearance-tab.tsx:54-57, 62-71, 91` — Language selector calls `router.push()` but **never** calls `updateUserSettings()`. **Root cause of locale bug.**
- `web/apps/dashboard/src/middleware.ts:75-136, 103` — `syncLocaleFromCore` already fetches locale from Core API using sentinel cookie `cf_locale_synced`. Pattern to extend for theme.
- `web/apps/dashboard/src/lib/api/http-api-client.ts:764-776` — `getUserSettings()` and `updateUserSettings()` typed and ready to call.

---

## 5. Architecture Decisions

### AD-1: Where the source of truth lives

DynamoDB row `UserSettingsEntity` (pk: `$causeflow#tenantid_<tid>`, sk: `settings#<userId>`). Cookies + localStorage are read-through caches for SSR / first paint only — they are **never** authoritative. Writes always go to the API first; the optimistic UI update happens in parallel.

### AD-2: Hydration path (prevents FOUC)

1. User hits any authenticated route.
2. Middleware (`middleware.ts`) checks sentinel cookie `cf_settings_synced`. If absent, fetches `GET /v1/users/:userId/settings`, writes `cf_theme`, `cf_locale`, and `cf_settings_synced` cookies, then redirects to the locale-correct route if needed.
3. `layout.tsx` inline script reads `cf_theme` cookie server-side → sets `<html class="dark">` before React hydrates → no flash.
4. Client-side ThemeProvider and next-intl pick up the same values on hydration — no mismatch.

**Decision:** reuse the existing `cf_locale_synced` pattern, just rename the sentinel to `cf_settings_synced` and sync both fields in the same round-trip.

### AD-3: UI wiring

- `ThemeProvider` in `packages/ui/` stays framework-agnostic — receives an optional `onThemeChange?: (theme) => Promise<void>` callback. Dashboard passes the callback wired to `updateUserSettings`. Keeps `packages/ui` free of API-client coupling.
- `appearance-tab.tsx` calls `updateUserSettings({ locale })` **before** `router.push()` — if the PATCH fails we toast and do not navigate.
- Theme change is optimistic (apply immediately, fire API, toast on error). Locale change is pessimistic (await API, then navigate) because the navigation is lossy — if we navigate first and the PATCH fails, the user is stranded on the wrong URL with no saved preference.

### AD-4: Zero migrations

Entity already has both fields with defaults. No schema change. No backfill. Existing rows that lack an explicit theme/locale simply fall through to `DEFAULT_SETTINGS`.

### AD-5: Cross-repo deploy ordering

Deploy Core first (idempotent — endpoints already exist, only potential change is an added integration test). Then deploy dashboard — which now calls those endpoints. Reverse ordering would ship a dashboard that calls endpoints that may not be updated yet. Since Core endpoints already work, this is a belt-and-braces precaution.

---

## 6. Data Model

No schema changes. Existing entity shape:

```ts
// core/src/shared/infra/db/entities/UserSettingsEntity.ts
{
  pk: "$causeflow#tenantid_<tid>",      // partition by tenant (IDOR-safe)
  sk: "settings#<userId>",              // one row per user
  tenantId: "org_3cie2py6g6xwnuu9ta0oopguw9u",
  userId:   "user_3cie11gerd6nx6vxxldluvlexlc",
  theme:    "light" | "dark" | "system",    // default "system"
  locale:   "en" | "pt-br",                 // default "en"
  createdAt, updatedAt
}
```

**Tenant isolation invariant:** `tenantId` in `pk` must equal the `org_id` claim in the caller's Clerk JWT. Enforced in `auth.middleware.ts` — never accepted from request params/body.

---

## 7. Security Boundaries

1. **tenantId sourcing:** ALWAYS from Clerk JWT `org_id`. NEVER from path param, body, header, or query. Current middleware already enforces — verify with a test that a forged `userId` in path cannot reach another tenant's row.
2. **Enum validation:** `updateSettingsSchema` (Zod) rejects anything outside `en|pt-br|light|dark|system` before it reaches DynamoDB. Verify in integration test for theme (mirror of existing locale test).
3. **SSR inline script XSS:** The value we embed into the inline `<script>` in `layout.tsx` comes from a cookie. We must (a) read the cookie server-side in a Next.js server component (not from arbitrary user input), (b) only accept known enum values, (c) never string-interpolate the value into the script — use a whitelist switch.
4. **Cookies:** `cf_theme`, `cf_locale`, `cf_settings_synced` are preference cookies, not session tokens. Set `Secure`, `SameSite=Lax`, `Path=/`, reasonable `Max-Age`. They contain nothing sensitive.
5. **Rate limiting:** `PATCH /v1/users/:userId/settings` is already behind auth middleware. If the existing rate limiter applies globally, we inherit it. Do not add a separate per-endpoint limiter in this PRD.
6. **Log hygiene:** Never log theme/locale values with userId+tenantId combined unless already standard in the logger — avoid creating a new PII surface.

---

## 8. Sprint Decomposition

Three sprints, sequential (each depends on the prior). Sprints 1 and 2 live in different repos; the orchestrator in `/plan-build-test` handles cross-repo branching.

### Sprint 01 — Core API verification + theme integration test

**Repo:** `causeflow/core`. **Estimated:** 20-30 min.

- Read existing endpoints, confirm theme handled by `updateSettingsSchema`.
- Add integration test mirroring `user-locale-settings.integration.test.ts` for theme PATCH (smoke: patch `theme: dark`, read back, assert; reject `theme: "invalid"` with 400).
- Add integration test for tenant-isolation on settings endpoints (forged `userId` returns 403/404, not 200).
- Push to `main` → auto-deploy to staging.
- **Acceptance:** staging healthcheck 200; `curl GET <staging>/v1/users/me/settings` with valid token returns JSON including `theme` + `locale`.

### Sprint 02 — Dashboard wiring (theme + locale persistence + SSR)

**Repo:** `causeflow/web`. **Estimated:** 45-60 min.

- Extend `ThemeProvider` in `packages/ui/src/themes/provider.tsx` with optional `onThemeChange` callback.
- In `apps/dashboard`, inject callback that calls `httpApiClient.updateUserSettings({ theme })`.
- Update `appearance-tab.tsx` so language change calls `updateUserSettings({ locale })` before `router.push()` (pessimistic — do not navigate if API fails).
- Extend `middleware.ts` `syncLocaleFromCore` → rename to `syncSettingsFromCore`, sync both theme + locale in one call, write cookies `cf_theme`, `cf_locale`, `cf_settings_synced`.
- Update `app/[locale]/layout.tsx` inline script: read `cf_theme` cookie, apply class with whitelist switch (no string interpolation of raw cookie value into `<script>`).
- Run `pnpm turbo check-types` + `pnpm exec biome check .` — clean.
- Run `pnpm dev` locally, smoke test theme toggle + language toggle via browser, capture screenshots of console (must be error-free).
- Push to `main` → auto-deploy to staging.

### Sprint 03 — Playwright E2E on staging + DynamoDB verification

**Repo:** `causeflow/web`. **Estimated:** 30-45 min.

- Playwright test against `https://dashboard-staging.causeflow.ai` using staging credentials from `.env.staging` (vinicius@simuser.ai).
- Steps: login → navigate settings → change theme dark → screenshot → reload → verify dark persists → change language to PT-BR → screenshot → verify URL is `/pt-br/...` → reload → verify language persists.
- Screenshot output: `.artifacts/playwright/screenshots/2026-04-17_<hhmm>/`.
- After UI flow, script hits authenticated `GET /v1/users/<userId>/settings` via `curl` (token from browser context), asserts `theme: "dark"` and `locale: "pt-br"`.
- **Acceptance:** all steps pass, screenshots exist, final GET returns expected values, DynamoDB row (verified indirectly via the authoritative GET response) contains the change. Direct DynamoDB read is not required — the API is the single source of truth and a 200 response proves the row.

---

## 9. Rollback Plan

- **Sprint 01:** Core-only change is additive (tests only). If a test is broken in staging CI, revert the commit; no data migration to undo.
- **Sprint 02:** If dashboard misbehaves on staging, revert the web PR. Cookies `cf_theme` / `cf_locale` become stale but harmless — the reverted middleware will just not set them, and the localStorage-only behavior resumes. Any rows already written to DynamoDB remain valid and will be consumed by the next deploy.
- **Sprint 03:** Test-only — no rollback needed.

---

## 10. Out of Scope

- Adding new locales beyond `en|pt-br`.
- Adding new themes beyond `light|dark|system`.
- Migrating existing users to have explicit settings rows (defaults handle them).
- Admin UI for viewing/editing another user's settings.
- Per-project or per-workspace theme overrides.
- Syncing the preference back to Clerk user metadata.

---

## 11. Open Questions

None at time of writing — all three design decisions confirmed by user in prior turn.

---

## 12. Evidence Required at Completion

- Screenshots in `.artifacts/playwright/screenshots/2026-04-17_<hhmm>/` showing theme and locale changes on staging.
- Passing Playwright run log.
- Authenticated `curl GET /v1/users/<userId>/settings` response body showing the test-set values.
- Clean browser console + clean server console (dashboard local dev during Sprint 02).
- Both repos' `main` branches deployed to staging (auto-deploy confirmed by checking staging responds correctly).

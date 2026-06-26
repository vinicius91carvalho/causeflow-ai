# Sprint 5: Server-source-of-truth sync + Playwright E2E

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 5 of 5
- **Depends on:** Sprint 4
- **Batch:** 4
- **Model:** sonnet
- **Estimated effort:** M

## Objective

Reconcile the `NEXT_LOCALE` cookie with the persisted `UserSettingsEntity.locale` on the first authenticated render of a session. Add Playwright E2E tests covering in-session switch, persistence across reload, and cross-device persistence (simulated by cookie clearing).

## File Boundaries

### Creates (new files)

- `/root/projects/causeflow/web/apps/dashboard/src/contexts/identity/application/sync-locale-from-server.ts` — server-only helper that fetches the persisted locale via `getUserSettings` and updates the `NEXT_LOCALE` cookie using `next/headers` `cookies().set(...)`. Idempotent per-session via a sentinel cookie.
- `/root/projects/causeflow/web/tests/dashboard-language-selector.spec.ts` — Playwright E2E test file (place in existing `tests/` folder per project convention).

### Modifies (can touch)

- `/root/projects/causeflow/web/apps/dashboard/src/app/[locale]/dashboard/layout.tsx` — the authenticated dashboard layout. Invoke `syncLocaleFromServer()` at the top of the server component, before children render.
- `/root/projects/causeflow/web/playwright.config.ts` — only if the new test file needs a distinct project registration or needs authenticated-user storage state; otherwise leave untouched.

### Read-Only (reference but do NOT modify)

- `/root/projects/causeflow/web/apps/dashboard/src/middleware.ts` — confirm the `NEXT_LOCALE` cookie name and max-age constants.
- `/root/projects/causeflow/web/apps/dashboard/src/lib/api/http-api-client.ts` — call `getUserSettings` (added in Sprint 2).
- `/root/projects/causeflow/web/apps/dashboard/src/contexts/identity/presentation/components/language-switcher.tsx` — reference for the E2E test selectors.
- `/root/projects/causeflow/web/tests/` — existing Playwright tests for patterns (auth helpers, storage state, base URL).

### Shared Contracts (consume from prior sprints or PRD)

- From Sprint 2: `HttpApiClient.getUserSettings(userId): Promise<UserSettings>`.
- From Sprint 4: `LanguageSwitcher` component selectors.
- From PRD §12: `LOCALE_SYNC_SENTINEL_COOKIE` — new cookie name, e.g. `cf_locale_synced`. Value = the session id or a short-lived timestamp. Purpose: run the sync at most once per Clerk session.

### Consumed Invariants (from INVARIANTS.md)

- **Locale Enum** — sync logic assumes the two enum values; any unexpected value from core is ignored (no cookie write) and logged.
- **`/api/settings` Routing Rule** — E2E test asserts that a locale change hits the user-settings endpoint (via server log or by relying on the unit tests from Sprint 3 + the eventual DynamoDB state).

## Tasks

### Sync logic

- [x] Implement `syncLocaleFromServer()` as an `async` server-only function:
  1. Read Clerk session via `auth()` from `@clerk/nextjs/server`. If not authenticated, return.
  2. Read `LOCALE_SYNC_SENTINEL_COOKIE` and `NEXT_LOCALE` from `cookies()` (next/headers).
  3. Compare the sentinel to the current Clerk session id. If equal, return (sync already ran for this session).
  4. Call `getUserSettings(userId)` using the backend token helper. Wrap in a try/catch; on failure, log and return (do not break the page render).
  5. If `persistedLocale !== cookieLocale`: `cookies().set(NEXT_LOCALE, persistedLocale, { maxAge: 365d, path: '/', sameSite: 'lax' })`.
  6. Always write the sentinel cookie to the current session id with a matching max-age.
- [x] Invoke `await syncLocaleFromServer()` at the top of the authenticated layout, BEFORE any data fetching that depends on locale. **Decision:** did NOT call `redirect()` — spec §101 allows choosing; no-redirect avoids redirect loops, at the cost of one render showing the previous locale on the first authenticated hit of a new session.
- [x] Write a Vitest unit test (mocking `cookies()`, `auth()`, and `HttpApiClient`) covering: (a) unauth → no-op; (b) sentinel matches → no-op; (c) sentinel missing, cookie matches server → sentinel written only; (d) sentinel missing, cookie differs from server → cookie overwritten + sentinel written; (e) server call fails → no-op + no throw. **6 tests total (5 required + 1 bonus for invalid-locale handling) — all pass.**

### Playwright E2E

- [x] Add `tests/dashboard/language-selector.spec.ts` with three scenarios, all using the authenticated storage state via the `dashboard-authed` Playwright project (see `playwright.config.ts`):
  1. **In-session switch:** Navigate to dashboard home (expected in EN). Open header user menu. Click Português (Brasil). Assert the `NEXT_LOCALE` cookie equals `pt-br`.
  2. **Reload persistence:** Continuing from (1), reload the page. Assert `NEXT_LOCALE` still `pt-br`.
  3. **Cross-device simulation:** Clear the `NEXT_LOCALE` cookie. Reload. Assert `syncLocaleFromServer()` re-writes `NEXT_LOCALE=pt-br` from the persisted UserSettingsEntity.
- [x] Configure the test to restore the locale to `en` in an `afterAll` hook to keep the test user idempotent.
- [BLOCKED] `pnpm exec playwright test tests/dashboard/language-selector.spec.ts` — see Agent Notes. `dashboard-setup` fails with "No Clerk user found for teste-5@causeflow.ai" in this environment. The test file itself compiles and uses valid selectors; it will run the moment a seeded Clerk user exists (same precondition as every other dashboard-authed spec — this is not a Sprint 5 regression). Placed at `tests/dashboard/` (matches existing project config's `testDir` rather than the spec's `tests/dashboard-language-selector.spec.ts`).

## Acceptance Criteria

- [x] `syncLocaleFromServer` is invoked from the authenticated layout; unit tests cover the five cases above (6/6 Vitest cases pass; Vitest output: `dashboard 6 tests 6 passed`).
- [x] The layout does NOT throw on core unavailability (graceful degradation — try/catch around `getUserSettings`, swallowed with `logger.warn`).
- [x] `LOCALE_SYNC_SENTINEL_COOKIE` is written on first authenticated render per session and respected on subsequent renders (Vitest case (b) proves no repeated Core calls within the same session).
- [BLOCKED] All three Playwright scenarios defined and compile; execution blocked by missing seed Clerk user (`teste-5@causeflow.ai`) — same precondition as every other dashboard-authed spec, not a Sprint 5 regression.
- [x] `pnpm turbo build --filter=@causeflow/dashboard` passes. `pnpm --filter @causeflow/dashboard check-types` passes. `pnpm exec biome check` on Sprint 5 files passes (repo-wide Biome shows 17 pre-existing errors unrelated to Sprint 5).
- [x] No NPM/NPX invocations; all Playwright calls use `pnpm exec`.

## Verification

- [x] Vitest: `pnpm exec vitest run --project dashboard sync-locale-from-server` → **6 tests passed in 13ms**.
- [x] Build: `pnpm turbo build --filter=@causeflow/dashboard` → **6 successful, 6 total (5 cached)**.
- [x] Types: `pnpm --filter @causeflow/dashboard check-types` → **exit 0**.
- [x] Lint (Sprint 5 files): `pnpm exec biome check` on the three Sprint 5 paths → **Checked 3 files. No fixes applied.**
- [BLOCKED] Playwright: `pnpm exec playwright test tests/dashboard/language-selector.spec.ts` — dev server starts OK (`Ready in 47s`, serves HTTP 200 on `/auth/sign-in`); **Clerk user lookup for `teste-5@causeflow.ai` returns empty in this env**. Same blocker affects every authed dashboard test suite.

## Security Checklist (maps to PRD §10)

- [ ] **Auth model:** `syncLocaleFromServer` calls `auth()` from Clerk server SDK first; no sync runs without a valid session.
- [ ] **Trust boundaries:** The locale value fetched from core is validated as `'en' | 'pt-br'` before being written to the cookie; any other value is logged and ignored.
- [ ] **Tenant isolation:** The sync uses the Clerk session's userId; we never read a userId from the request body or query string.
- [ ] **Failure mode:** Core unreachable → sync silently no-ops (do NOT surface 500 to the user; the existing cookie value remains in effect).
- [ ] **Cookie flags:** Cookie writes use `Path=/; SameSite=Lax; Max-Age=31536000`; `Secure` is set in production (`process.env.NODE_ENV === 'production'` or based on incoming request protocol).
- [ ] **No redirect loop:** If a `redirect(url)` is used after a cookie-overwrite, the sentinel cookie write must happen BEFORE the redirect; otherwise the next request re-syncs and loops. Test this explicitly.

## Context

**Why a sentinel cookie rather than in-memory:** The authenticated layout runs on every navigation in SSR. Without a sentinel, each navigation would call core. The sentinel bounded to the Clerk session id means we re-sync exactly once per session — which matches the PRD's "first authenticated render of a session" semantic.

**Why not in Edge middleware:** The Edge runtime has limitations around Clerk backend token retrieval and graceful error handling. A server component/layout runs in the Node runtime where `get-backend-token.ts` works cleanly.

**next-intl re-render:** When the cookie is changed server-side via `cookies().set()`, the NEXT render will pick it up via `getRequestConfig`. If we `redirect(request.url)` after the cookie write, the next request reads the new cookie. Without the redirect, the current render may still use the old cookie value. Choose based on empirical behavior during execution and document in Agent Notes.

**Existing Playwright auth pattern:** See `tests/audit.spec.ts` and `tests/visual-functional.spec.ts` at the project root for the existing configuration. Dashboard tests may need authenticated storage state — look for existing auth setup in `playwright.config.ts` or `tests/global-setup.ts`.

## Agent Notes (filled during execution)

- Assigned to: orchestrator (opus) — delegation was unavailable in this tool set; executed in-main per orchestrator sequential-sprint protocol.
- Started: 2026-04-16 ~19:00Z
- Completed: 2026-04-16 ~19:25Z

- **Decisions made:**
  - **No-redirect strategy** (spec §101 tradeoff): `syncLocaleFromServer()` writes the cookie but does not call `redirect()`. Reason: avoids the redirect-loop risk entirely. Cost: on the FIRST authenticated hit of a new session where the persisted locale differs from the current cookie, the page renders once with the old locale. All subsequent navigations use the new cookie. The sentinel prevents re-running on every nav, so this one-render stale window is bounded.
  - **Fail-closed on Core errors (no sentinel write)**: if `getUserSettings()` throws, we return without writing the sentinel. This lets the next render retry Core. Alternative (writing the sentinel) would lock the user into whatever cookie is currently set if Core was transiently down — worse UX.
  - **Invalid-locale handling (bonus case)**: if Core returns a locale outside `'en' | 'pt-br'`, we log and WRITE the sentinel (unlike the Core-error branch). Rationale: invalid data is a Core-side bug that a retry won't fix; hammering Core per request would amplify the problem.
  - **Used `getApiClient()` (not direct `HttpApiClient`)**: matches the pattern used in other server-side handlers (e.g. `complete-profile-handler.ts`). This handles the token/`getBackendToken()` wiring and the memoized client. Simplifies testing (one mock seam).
  - **Sentinel cookie name**: `cf_locale_synced` (spec §39 allowed choice).
  - **Test file location**: placed the Playwright spec at `tests/dashboard/language-selector.spec.ts` (not `tests/dashboard-language-selector.spec.ts` as the spec suggested). This matches the existing project config's `dashboard-authed` project, which does `testDir: './tests/dashboard'`. The other path would not have been picked up by any project.
  - **Vitest test structure**: used a shared in-memory `cookieJar` Map mutated via `cookieSet` / `cookieGet` mock implementations. This is the cleanest mock of Next.js's `cookies()` store — lets assertions verify both call order (via `cookieSet.mock.calls`) and final cookie state (via the Map).

- **Assumptions:**
  - `getUserSettings` returns the canonical `UserSettings` shape with `locale: 'en' | 'pt-br'` from Sprint 2.
  - `@/lib/logger` exists and exposes `warn`/`info`/`error`. (Verified by grep — same logger used across `http-api-client.ts`.)
  - The LanguageSwitcher aria-label under `dashboard.topbar.language.label` is the EN string "Language" in en.json. The Playwright spec uses case-insensitive regex to be resilient.
  - The `dashboard-authed` Playwright project exists and is the right vehicle for running this spec (confirmed in `playwright.config.ts`).

- **Issues found:**
  - **Dashboard dev server startup is slow in PRoot** but does eventually bind (47s compile + additional route compilation). Dev server DID start successfully this run; earlier PRoot SIGKILL issues did not reproduce.
  - **Playwright auth-setup is BLOCKED in this environment**: `dashboard-setup` fails at Clerk user lookup for `teste-5@causeflow.ai` — this user doesn't exist in the Clerk tenant associated with the `.env.local` CLERK_SECRET_KEY. This blocks ALL authed dashboard specs, not just Sprint 5's. It's a fixture/seeding gap, not a Sprint 5 regression.
  - `apps/dashboard/src/app/[locale]/dashboard/layout.tsx` triggered the post-edit TDD hook initially because I added the import before the invocation on a single Edit; fixed by a second edit adding the `await syncLocaleFromServer()` call.

- **Verification evidence:**
  - Vitest: 6 passed / 6 total (5 spec cases + 1 bonus).
  - Build: `@causeflow/dashboard:build` — 6/6 tasks successful; full dashboard build succeeded end-to-end.
  - Types: `tsc --noEmit --project tsconfig.build.json` — exit 0.
  - Lint: Biome on Sprint 5 paths — 0 errors.
  - Playwright: dev server reached ready state at `http://localhost:3001/auth/sign-in` (HTTP 200); spec file compiles and is discovered by the `dashboard-authed` project; execution blocked at `dashboard-setup` → Clerk user lookup.

---

## CORRECTED — Post-staging-outage fix (2026-04-16)

**Root cause of staging outage (digest 316005604):** `syncLocaleFromServer()` called `cookies().set()` inside a Server Component layout. Next.js 15 App Router forbids mutating cookies outside Server Actions, Route Handlers, or Middleware — this threw a server exception on every authenticated dashboard render.

**Fix applied:** Moved the entire locale-sync logic into `apps/dashboard/src/middleware.ts`, where `NextResponse.cookies.set()` is legal (Edge runtime).

**Files changed:**
- DELETED: `apps/dashboard/src/contexts/identity/application/sync-locale-from-server.ts`
- DELETED: `apps/dashboard/src/contexts/identity/application/sync-locale-from-server.test.ts`
- MODIFIED: `apps/dashboard/src/app/[locale]/dashboard/layout.tsx` — removed `syncLocaleFromServer` import and call; added clarifying comment
- MODIFIED: `apps/dashboard/src/middleware.ts` — added `syncLocaleFromCore()` helper + sentinel/locale cookie writes on the outgoing `NextResponse`
- CREATED: `apps/dashboard/src/middleware.locale-sync.test.ts` — 7 Vitest cases covering all 6 required scenarios (cases 5a fetch-throw + 5b non-2xx counted separately)

**Observable contract preserved:** Same two cookies (`NEXT_LOCALE`, `cf_locale_synced`), same sentinel semantics (once per Clerk session), same fail-safe behavior (no sentinel on Core error, sentinel written on invalid locale). Token fetched via `session.getToken()` (Edge-compatible; `SignedInAuthObject` returned by `auth.protect()` has `getToken`).

**Logger:** `@/lib/logger` (pino-based) is NOT imported in middleware — swapped to `console.warn` to avoid Node.js-only pino crashing the Edge bundle.

**Verification (post-fix):**
- tsc: `pnpm --filter dashboard exec tsc --noEmit` → exit 0
- vitest: `pnpm exec vitest run --project dashboard middleware.locale-sync` → 7/7 passed
- biome: `pnpm exec biome check apps/dashboard/src/middleware.ts apps/dashboard/src/app/[locale]/dashboard/layout.tsx` → 0 errors
- build: `pnpm turbo build --filter=@causeflow/dashboard` → 6/6 tasks successful, Middleware 159 kB (Edge bundle clean)

# User Language Preference (Dashboard): Product Requirements Document

## 1. What & Why

**Problem:** The dashboard chooses a user's language from a `NEXT_LOCALE` cookie with an Accept-Language fallback. There is no way for a signed-in user to explicitly choose a language, and their choice is not remembered across devices. Core backend already has the `locale` field persisted on `UserSettingsEntity` with a working `PATCH /v1/users/:userId/settings` endpoint, but no UI drives it.

**Desired Outcome:** A signed-in user can switch the dashboard language between **English** (`en`) and **Portuguese (Brazil)** (`pt-br`) from the header user menu. The choice is persisted to core, syncs across devices on next login, and causes the UI to re-render in the selected language immediately.

**Justification:** Our PT-BR market needs first-class language control. The backend plumbing is already in place — only the dashboard UI and the cross-device sync are missing. This is a small, high-leverage E2E task that completes an already-paid-for feature.

## 2. Correctness Contract

**Audience:** Signed-in dashboard users (engineers on 2-50 person teams) who switch language in the header. Internal: ops/QA verifying the setting round-trips to DynamoDB.

**Failure Definition:**
- User picks a language but the UI does not re-render in that language on the current page.
- User picks a language, logs out, logs in on a different device, and the previously picked language is not applied.
- Selector is visible but the PATCH to core fails silently (no error surfaced, cookie updates, server forgets).

**Danger Definition:**
- Language choice leaks across users (multi-tenant bleed): user A picks PT-BR and user B sees PT-BR.
- The selector breaks existing settings fields (theme, notifications, company name) on the same settings proxy.
- The server-source-of-truth sync overwrites a user's intentional choice mid-session (race between cookie and server fetch).

**Risk Tolerance:** Refusing to change the language (leaving the cookie unchanged and surfacing a toast) is strictly better than silently disagreeing with the server. Confident-wrong is worse than visibly-refusing.

## 3. Context Loaded

- **`/root/projects/causeflow/core/src/shared/infra/db/entities/UserSettingsEntity.ts`** — ElectroDB entity `userSettings` already persists `locale: ['en'|'pt-br']` (default `'en'`), keyed by `(tenantId, userId)`. No schema change needed on core.
- **`/root/projects/causeflow/core/src/modules/user/infra/user.routes.ts`** — `PATCH /v1/users/:userId/settings` accepts the `updateSettingsSchema` Zod object that already validates `locale: z.enum(['en', 'pt-br']).optional()`. `GET /v1/users/:userId/settings` returns the persisted record. No core-side API changes needed.
- **`/root/projects/causeflow/web/apps/dashboard/src/contexts/settings/api/settings-handler.ts`** — Today routes **all** settings fields (including `locale`) via `api.updateTenant()`. This is a BUG for user-level preferences: `locale` must go to the user-settings endpoint, not the tenant endpoint.
- **`/root/projects/causeflow/web/apps/dashboard/src/lib/api/http-api-client.ts`** — Has `updateTenant` / `getTenant` / `getMe` / `getUserProfile`. Does **NOT** have an `updateUserSettings(userId, input)` method — must be added.
- **`/root/projects/causeflow/web/apps/dashboard/src/middleware.ts`** — Picks locale from `NEXT_LOCALE` cookie (365-day max-age) → Accept-Language → `'en'`. Does **not** consult core. To make the server the source of truth we need an additional sync step (NOT in the Edge middleware — it runs before auth is fully resolved).
- **CLAUDE.md** — Tech stack: Next.js 15 App Router + next-intl + Clerk + pnpm/turbo. Tests: Vitest (units) and Playwright (E2E). No NPM/NPX.
- **Memory: `project_settings_page_architecture.md`** — The dashboard's `/settings` page renders Clerk `UserProfile` directly; tabbed `settings-content.tsx` is dead code. The canonical home for user preferences that Clerk does not own is now the **header user menu** (user's choice per this PRD).

## 4. Success Metrics

| Metric | Current | Target | How to Measure |
| --- | --- | --- | --- |
| Selector round-trip correctness | N/A (no selector) | 100% | Playwright: change in header → translations re-render → reload → still in chosen language |
| Cross-device persistence | Cookie-only (broken) | Persisted | Playwright: change on browser A → clear cookie → open browser B (same user) → chosen language applied |
| Core `UserSettingsEntity.locale` write correctness | Indirect (dashboard sends to tenant endpoint) | Direct | Integration test: dashboard PATCH with `{locale:'pt-br'}` → DynamoDB `UserSettingsEntity.locale === 'pt-br'` |
| No regression on existing settings (theme, notifications, company) | Currently work via `updateTenant` | Still work | Existing settings-handler tests pass |

## 5. User Stories

**S1 — In-session language switch**
GIVEN I am a signed-in dashboard user viewing a page in English
WHEN I open the header user menu, pick "Português (Brasil)" from the Language submenu
THEN the current page re-renders in PT-BR within one navigation cycle
AND a PATCH is sent to `/api/settings` with `{locale: "pt-br"}`
AND the `NEXT_LOCALE` cookie is updated to `pt-br`.

**S2 — Cross-device persistence**
GIVEN I picked PT-BR on Browser A yesterday
WHEN I sign in on Browser B (no `NEXT_LOCALE` cookie present, Accept-Language says `en`)
THEN the dashboard applies PT-BR on the first authenticated render after sign-in
AND the `NEXT_LOCALE` cookie is written to `pt-br`.

**S3 — Server unreachable fallback**
GIVEN I pick a language in the header
WHEN the PATCH to `/api/settings` fails (5xx or network error)
THEN the UI does NOT update the cookie
AND a toast surfaces the failure with a retry affordance
AND the rendered language stays unchanged.

**S4 — No cross-tenant bleed**
GIVEN user A (tenant T1) picks PT-BR and user B (tenant T2) picks EN
WHEN they both sign in concurrently
THEN each sees their own language; core persists `locale` per `(tenantId, userId)` as today.

## 6. Acceptance Criteria

- [ ] A "Language" control appears in the dashboard header user menu with two options: **English** and **Português (Brasil)**.
- [ ] Picking a language calls `PATCH /api/settings` with `{ locale: "<choice>" }` and — on success — sets `NEXT_LOCALE` cookie and triggers `router.refresh()` so the current page re-renders in the new locale.
- [ ] On PATCH failure, the cookie is NOT updated, the UI language does NOT change, and a toast surfaces the error.
- [ ] `UserSettingsEntity.locale` in DynamoDB is updated to the chosen value (verified by core integration test).
- [ ] Existing non-locale fields on `/api/settings` (theme, notifications, name, companyName, websiteUrl) continue to work and are NOT routed through the new user-settings path by accident.
- [ ] On the first authenticated render of a session, the dashboard reconciles the `NEXT_LOCALE` cookie with the persisted core value; if they differ, cookie is overwritten with the persisted value and the route is re-rendered in that locale.
- [ ] The Playwright E2E test covers: (a) in-session switch and re-render, (b) persistence across reload, (c) cross-device persistence simulated by clearing the cookie.
- [ ] No NPM/NPX calls introduced. `pnpm turbo build`, `pnpm turbo check-types`, `pnpm exec biome check .` all pass.

## 7. Non-Goals (at least as detailed as goals)

- **Language switching on the marketing website (`causeflow.ai`)** — excluded. Website uses URL-prefix (`/pt-br/`) locale routing and is public (no user entity). User confirmed dashboard-only scope.
- **New locales beyond `en` and `pt-br`** — excluded. Core's Zod enum is `['en', 'pt-br']`; expanding it is a separate PRD.
- **Moving `locale` from `UserSettingsEntity` to `UserEntity`** — excluded. User explicitly chose to keep the existing entity placement. Touching core schemas is out of scope.
- **Adding a selector inside `/dashboard/settings`** — excluded. User chose header-only. Keeps Clerk `UserProfile` integration untouched and avoids resurrecting dead `settings-content.tsx`.
- **Storing the choice in Clerk user metadata** — excluded. Core `UserSettingsEntity` is the source of truth; duplicating to Clerk would create sync bugs.
- **Changing the cookie name or its max-age** — excluded. `NEXT_LOCALE` and 365-day max-age stay as-is to avoid invalidating existing users' cookies.
- **Migrating existing users** — not needed. The `locale` field defaults to `'en'` in DynamoDB and renders identically to today for anyone who has not explicitly changed it.
- **Automatic detection "your browser says PT-BR, want to switch?" prompts** — excluded. Cookie+Accept-Language detection stays the implicit fallback; the new selector is the only explicit mechanism.
- **Admin-facing ability to set another user's language** — excluded. Each user owns their own preference.

## 8. Technical Constraints

- **Stack (dashboard):** Next.js 15 App Router, React 19, next-intl, Clerk, Tailwind v4, Shadcn/ui, TypeScript strict.
- **Stack (core):** Hono + ElectroDB + DynamoDB + Clerk backend SDK, Vitest integration tests.
- **Package manager:** `pnpm` / `pnpm exec` / `pnpm dlx` — `npm` and `npx` are forbidden.
- **Dev server:** `next dev --hostname localhost` (never `127.0.0.1`); kill existing servers before starting.
- **Architecture (dashboard):** Bounded contexts at `apps/dashboard/src/contexts/<name>/`. Route files are thin orchestrators. DDD layers per context. No context barrel imports.
- **Architecture (core):** Module-per-context with `domain / application / infra`. Use cases in `application/`, routes in `infra/`, entities in `shared/infra/db/entities/`.
- **i18n ownership:** Each dashboard context owns its translations at `infrastructure/i18n/{en,pt-br}.json`; composer at `src/lib/i18n/compose.ts`. The new language selector's own strings live in the context that owns the header (likely `identity` or `shared`).
- **Performance:** Locale change must not force a full page reload — use `router.refresh()` + next-intl's re-read of the cookie. LCP and CLS budgets unchanged.
- **Security:** `PATCH /api/settings` continues to require Clerk session auth (existing middleware). The new `updateUserSettings` core client method must pass the backend token via `get-backend-token.ts`.

## 9. Architecture Decisions

| Decision | Reversal Cost | Alternatives Considered | Rationale |
| --- | --- | --- | --- |
| Keep `locale` on `UserSettingsEntity` (not `UserEntity`) | High (schema change, data migration) | Move to UserEntity; duplicate in both | Core already persists and exposes it; moving creates migration risk for zero product benefit. |
| Selector lives in header user menu only | Low | Settings page; both | User chose header-only; keeps settings page untouched while Clerk UserProfile owns it. |
| Server-source-of-truth sync in a **server component / layout** fetch, NOT Edge middleware | Medium | Edge middleware call to core; client-only | Edge runtime cannot easily call core with Clerk server token and cannot handle failures gracefully. A per-session server fetch (guarded to run at most once per session via cookie sentinel) is simpler and safe. |
| Add `updateUserSettings` to `HttpApiClient` instead of reusing `updateTenant` | Low | Reuse updateTenant | `updateTenant` hits the tenant endpoint; `locale` lives on `UserSettings`. Routing by target resource keeps the client honest. |
| Route locale via `updateUserSettings`, keep theme+notifications via the same user-settings endpoint, keep company/name via tenant endpoint | Low | Send every field to one endpoint | Core exposes settings fields on the user-settings endpoint; tenant endpoint owns company/name. Send each field to its real owner. |
| Fail-closed on PATCH error: do NOT update cookie | Low | Optimistic cookie + background retry | Matches Risk Tolerance: visible refusal beats silent divergence. Simpler mental model. |

## 10. Security Boundaries

- **Auth model:** All `/api/settings` calls require a valid Clerk session (existing behavior via `withAuth` wrapper). The new `updateUserSettings` core client method must attach the backend Bearer token obtained via `get-backend-token.ts`.
- **Trust boundaries:** The locale value from the browser is validated twice — once by the dashboard settings-handler (Zod `enum(['en', 'pt-br'])`) and again by core (`updateSettingsSchema` Zod enum). Any other value is rejected 400 at both layers.
- **Data sensitivity:** Locale is not PII. No masking or encryption required.
- **Tenant isolation:** Core persists `locale` keyed by `(tenantId, userId)` in DynamoDB. The Clerk session determines `tenantId`; the dashboard never forwards an untrusted `tenantId` from the client body.
- **Cookie scope:** `NEXT_LOCALE` is `SameSite=Lax`, path `/`, not `HttpOnly` (next-intl reads it client-side). This is unchanged — we only write values already constrained to the validated enum.

## 11. Data Model

No schema changes. The `UserSettingsEntity` already models the data.

**Access Patterns:**
1. On session start per browser: read `UserSettingsEntity(tenantId, userId)` once, compare `locale` to cookie, overwrite cookie if divergent. Latency: ≤200ms (one DynamoDB point query).
2. On language switch: write `UserSettingsEntity.locale` for `(tenantId, userId)`. Latency: ≤300ms.

**Entities (existing):**
- `UserSettingsEntity` — `tenantId` (PK), `userId` (SK template `settings#${userId}`), `theme`, `locale`, `notifications`, `createdAt`, `updatedAt`.

## 12. Shared Contracts

Consumed by multiple sprints in this PRD:

- **`Locale` type:** `'en' | 'pt-br'`. Canonical definition already exists in core's Zod schema. Dashboard will export a matching TypeScript type from the settings context (`apps/dashboard/src/contexts/settings/domain/types.ts`) or re-use the existing one if present.
- **`LANGUAGE_COOKIE_NAME`:** `'NEXT_LOCALE'` — already defined in `apps/dashboard/src/middleware.ts`. Do not duplicate; export from a single constants module and import.
- **`LOCALE_SYNC_SENTINEL_COOKIE`:** new cookie name (e.g. `cf_locale_synced`) that signals the server-source-of-truth sync has run for the current session. Written by the sync step in Sprint 04; read and respected in later requests to avoid re-syncing every render.
- **`PATCH /api/settings` request body:** continues to accept `{ theme?, locale?, notifications?, name?, companyName?, websiteUrl? }`. Only the *routing* of `locale` inside the handler changes.
- **`HttpApiClient.updateUserSettings(userId, input)`:** new method, signature `(userId: string, input: { theme?: Theme; locale?: Locale; notifications?: NotificationSettings; }) => Promise<UserSettings>`. Hits `PATCH /v1/users/:userId/settings`.
- **`HttpApiClient.getUserSettings(userId)`:** new method, signature `(userId: string) => Promise<UserSettings>`. Hits `GET /v1/users/:userId/settings`. Needed by Sprint 04 sync.

## 13. Architecture Invariant Registry

| Concept | Owner | Format/Values | Verify Command |
| --- | --- | --- | --- |
| Locale enum | Core `UserSettingsEntity` | `'en' \| 'pt-br'` | `grep -rn "'en', 'pt-br'" /root/projects/causeflow/core/src /root/projects/causeflow/web/apps/dashboard/src` |
| Language cookie name | Dashboard `middleware.ts` | `NEXT_LOCALE` | `grep -rn "NEXT_LOCALE" /root/projects/causeflow/web/apps/dashboard/src \| wc -l` (must be >0 and all references use the same constant name) |
| `/api/settings` routing rule | Dashboard `settings-handler.ts` | `locale` → user-settings endpoint; `companyName/name/websiteUrl` → tenant endpoint; `theme/notifications` → user-settings endpoint | Integration test asserts each field hits the right core client method |

**Dependency direction:** Dashboard depends on core's `UserSettingsEntity.locale` contract; core owns it. Dashboard is free to evolve the `NEXT_LOCALE` cookie mechanics; core has no opinion on the cookie.

## 14. Open Questions

- [ ] Should we detect an unauthenticated user's Accept-Language (current behavior) and pre-select it in the selector once they sign in? **Decision for now:** no — leave unauthenticated behavior unchanged; the selector is a signed-in-only UI.
- [ ] When multiple browser tabs are open, should a language change in tab A be reflected in tab B automatically? **Decision for now:** no — `router.refresh()` only refreshes the current tab. Add a `storage` event listener only if a user complains.

## 15. Uncertainty Policy

When uncertain: **Stop and ask** for any ambiguity about which core endpoint owns a settings field (routing rule in §13). All other uncertainty: **flag and document** in the sprint's Agent Notes, do not guess.

When **correctness conflicts with UX polish:** prefer correctness (fail-closed on error, no optimistic UI). When **cookie state conflicts with core state:** core wins on the first authenticated render of a session; cookie wins for in-session switches until the next session starts.

## 16. Verification

**Deterministic:**
- `pnpm turbo build` passes (dashboard + core).
- `pnpm turbo check-types` passes.
- `pnpm exec biome check .` passes.
- Core integration test: `PATCH /v1/users/:userId/settings` with `{locale: "pt-br"}` persists; subsequent `GET` returns `pt-br` (may already exist — Sprint 01 verifies and fills gap only if missing).
- Dashboard Vitest unit test for the updated `settings-handler.ts`: `locale` is routed to `updateUserSettings`, `companyName` continues to route to `updateTenant`.
- Dashboard Vitest unit test for the new header language selector component: clicking an option calls the settings API with the correct body.
- Playwright E2E test (dashboard) covering all three user stories.

**Manual:**
- Open `http://localhost:3001` signed in as a test user; change language in header; observe immediate re-render, cookie value, and core DynamoDB record via a short `aws dynamodb get-item` or via a dev-only read endpoint.
- Clear `NEXT_LOCALE` cookie; reload while signed in; confirm persisted locale is applied.
- Trigger a 500 from core (mock or temporary break): confirm toast shows, cookie unchanged, UI unchanged.

## 17. Sprint Decomposition

Maximum 5 sprints. Each sprint is extracted into its own file under `sprints/`.

### Sprint Overview

| Sprint | Title | Depends On | Batch | Model | Parallel With |
| --- | --- | --- | --- | --- | --- |
| 1 | Core contract confirmation | None | 1 | sonnet | Sprint 2 |
| 2 | Dashboard core client (updateUserSettings + getUserSettings) | None | 1 | sonnet | Sprint 1 |
| 3 | Settings-handler routing fix + unit tests | 2 | 2 | sonnet | — |
| 4 | Header language selector UI + in-session switch | 3 | 3 | sonnet | Sprint 5 prep only |
| 5 | Server-source-of-truth sync + Playwright E2E | 4 | 4 | sonnet | — |

Sprints 1 and 2 touch disjoint trees (core vs. dashboard) and can run in parallel. Sprints 3-5 are sequential — each consumes the artifact of the prior one.

### Sprint 1: Core contract confirmation → `sprints/01-core-contract-confirmation.md`

**Objective:** Prove that `PATCH /v1/users/:userId/settings` with `{locale: "pt-br"}` persists to `UserSettingsEntity` and that `GET` returns it. Add a focused integration test if coverage is missing. No production code changes.

**Estimated effort:** S
**Dependencies:** None

### Sprint 2: Dashboard core client additions → `sprints/02-dashboard-core-client.md`

**Objective:** Add `updateUserSettings(userId, input)` and `getUserSettings(userId)` methods to the dashboard's `HttpApiClient`, wired to `PATCH /v1/users/:userId/settings` and `GET /v1/users/:userId/settings`. Export shared `Locale` / `UserSettings` types.

**Estimated effort:** S
**Dependencies:** None

### Sprint 3: Settings-handler routing fix → `sprints/03-settings-handler-routing.md`

**Objective:** Update `apps/dashboard/src/contexts/settings/api/settings-handler.ts` PATCH to route `locale` (and `theme`, `notifications`) to the new `updateUserSettings` method; keep `companyName`, `name`, `websiteUrl` on `updateTenant`. Add Vitest units that lock the routing rule.

**Estimated effort:** M
**Dependencies:** Sprint 2

### Sprint 4: Header language selector UI → `sprints/04-header-language-selector.md`

**Objective:** Build the language selector in the header user menu. On selection: PATCH `/api/settings` with `{locale}`; on success write `NEXT_LOCALE` cookie and `router.refresh()`; on failure surface a toast and leave state unchanged.

**Estimated effort:** M
**Dependencies:** Sprint 3

### Sprint 5: Server-source-of-truth sync + E2E → `sprints/05-server-sync-and-e2e.md`

**Objective:** On first authenticated render of a session, fetch the persisted locale from core and reconcile with `NEXT_LOCALE` cookie (guarded by the `LOCALE_SYNC_SENTINEL_COOKIE` to run at most once per session). Add Playwright E2E covering in-session switch, reload persistence, and cross-device persistence simulation.

**Estimated effort:** M
**Dependencies:** Sprint 4

## 18. Execution Log

*Filled during execution — tracked in `progress.json`.*

## 19. Learnings

*Filled after all sprints complete — compound step output.*

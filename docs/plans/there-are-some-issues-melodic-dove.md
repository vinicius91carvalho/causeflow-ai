# PRD: Dashboard Integration Hardening + Test-Error Round-Trip

**Mode:** PRD + Sprint (multi-component: `web/apps/dashboard` + `core`, ~5 sprints)
**Build candidate target:** `build-candidate/dashboard-integration-hardening`
**Final spec home (to be created during planning execution):** `web/apps/dashboard/docs/tasks/integrations/feature/2026-04-27-1530-integration-hardening/`

---

## Context

Three production-visible bugs in the staging dashboard, plus a documented testing-discipline gap that caused them. The user discovered each bug by clicking through the staging dashboard — **none** were caught by automated tests, because none exist for these flows. Fix the bugs *and* close the verification loop so future regressions surface in CI.

### The bugs

1. **Sentry integration: incomplete setup + no proof of life.** The setup-instructions modal walks users through Sentry → Settings → Integrations but does not describe selecting **Internal Integration**, granting **Issue & Event read** + **Webhook read**, or subscribing to the five issue events (`created`, `resolved`, `assigned`, `archived`, `unresolved`). After the user adds the trigger, the dashboard shows **Triggers (1) — SENTRY_NEW_ISSUE registered** but the system has no way to know whether the user actually completed the Sentry-side setup. The modal becomes unreachable, so a misconfigured user has no recovery path.

   Sentry's Internal Integration emits a **Client Secret** (e.g. `e0147e7…`) that signs every webhook with `Sentry-Hook-Signature`. Today the core webhook middleware (`webhook-auth.middleware.ts`) only accepts `X-Webhook-Signature` and looks up the secret via `X-API-Key`. Sentry sends neither header — so even if the user pastes our URL correctly, the request 401s. There is **no per-integration client-secret storage** and **no `verified` flag** on the integration row.

2. **Slack card looks different from every other integration.** `integration-card.tsx` is the canonical card with status pill + connect/reconnect/disconnect/test buttons + trigger dropdown. It explicitly excludes Slack (`type !== 'slack'`). Slack is rendered by a custom `slack-settings.tsx` with a dialog-confirmed disconnect link instead of the shared button bar. Visually inconsistent.

3. **"Fire Test Error" button doesn't reach Sentry.** The button on `/dashboard/settings` POSTs to `/api/admin/fire-test-errors`, which is wired to core's `POST /admin/fire-test-errors`. The core handler simulates Sentry payloads by calling `ingestAlert.execute()` directly — it never `throw`s an error inside the request, so the core's Sentry SDK never captures, Sentry.io never receives, and Sentry never calls our webhook back. The user-intent ("test the full Sentry → core webhook loop") is unmet.

### The testing-discipline gap

The user explicitly called out: "A lot of issues happened, because it wasn't tested." Current testing reality:

- A single E2E exists for Settings (`web/tests/e2e/dashboard/settings-fire-test-errors.spec.ts`) but it asserts the dashboard's button-click happy path, not the Sentry round-trip.
- No E2E covers `/dashboard/integrations` Sentry or Slack flows.
- AWS CloudWatch logs (`/ecs/causeflow-staging-api`) are not consulted when verifying staging changes.

**This PRD codifies, in `web/apps/dashboard/CLAUDE.md` and `web/CLAUDE.md`, the testing-and-verification protocol the user wants enforced going forward** (Playwright + AWS log tail + ask-user-for-manual-Sentry-config). Future tasks under `web/apps/dashboard/` inherit it.

### Non-goals

- Not redesigning the integrations page.
- Not adding new Sentry trigger types beyond `SENTRY_NEW_ISSUE` (already wired).
- Not multi-Sentry-integration-per-tenant (one per tenant, matches `/v1/webhooks/{tenantId}/sentry` URL shape).
- Not webhook-secret rotation UX.

---

## Context Loaded

**Critical files (verified to exist):**

Backend (`core/`):
- `core/src/modules/ingestion/infra/webhook.routes.ts` — `POST /:tenantId/:provider`, registered at `/v1/webhooks` in `core/src/app.ts:100`.
- `core/src/shared/infra/http/middleware/webhook-auth.middleware.ts` — current HMAC verification (expects `X-Webhook-Signature`, hex with `sha256=` prefix, uses per-API-key `webhookSecretHash` or global secret fallback).
- `core/src/modules/ingestion/infra/parsers/sentry.parser.ts` — already parses Sentry payload shape `{ action, data.issue }`.
- `core/src/modules/ingestion/infra/admin.routes.ts` — `POST /admin/fire-test-errors` (exists, but doesn't `throw`).
- `core/src/shared/infra/observability/sentry.ts` — Sentry SDK init (`SENTRY_DSN`).
- `core/src/shared/application/ports/token-encryption.port.ts` — existing encryption port for at-rest secrets (reuse).
- `core/INVARIANTS.md` — I1–I7. I7 (env names): only `staging`/`production`. New invariant likely needed (see §INVARIANTS).

Frontend (`web/apps/dashboard/`):
- `web/apps/dashboard/src/contexts/integrations/presentation/pages/integrations-page.tsx`.
- `web/apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx` (410 lines; status enum: `available | connected | error | disconnected`; explicitly excludes Slack at `type !== 'slack'`).
- `web/apps/dashboard/src/contexts/integrations/presentation/components/slack-settings.tsx` (115 lines; custom panel).
- `web/apps/dashboard/src/contexts/integrations/domain/types.ts` (Integration / SentryTriggerType etc.).
- Sentry-specific component to be located under `…/integrations/presentation/components/*sentry*.tsx` (modal copy lives here).
- `web/apps/dashboard/src/contexts/settings/presentation/components/fire-test-errors-card.tsx` (POSTs `/api/admin/fire-test-errors`).
- `web/apps/dashboard/src/lib/api/{core-api-client,http-api-client}.ts`.
- `web/playwright.config.ts`, `web/tests/e2e/dashboard/`, `web/tests/e2e/dashboard/settings-fire-test-errors.spec.ts` (existing).
- `web/apps/dashboard/.env.staging` (credentials for staging login).

**Verified gaps to close:**
- No `Sentry-Hook-Signature` handling.
- No per-integration `clientSecret` field, no `verified` / `verifiedAt` / `lastEventAt` fields on the Sentry integration row.
- Fire-test-errors handler does not throw inside an HTTP request, so Sentry SDK never captures.
- The Next.js proxy route at `/api/admin/fire-test-errors` needs to be confirmed to exist and forward Clerk auth correctly to core.

**Reusable utilities (do NOT re-implement):**
- `token-encryption.port.ts` for client-secret at-rest encryption.
- `webhookAuth` middleware skeleton — extend, don't fork.
- `IntegrationCard` (`integration-card.tsx`) — Slack must use this, not a parallel component.
- `requireRole`, `c.get('tenantId')` patterns from existing routes.

---

## Architecture Decisions

### AD-1: Sentry webhook auth as a *route-scoped* middleware, not an extension of `webhookAuth`

Sentry's signature scheme differs from the generic `X-Webhook-Signature` flow (different header, no `sha256=` prefix per Sentry docs, no `X-API-Key` lookup — secret is bound by the URL's `tenantId` segment + the integration row's stored `clientSecret`). Adding branches to `webhookAuth` would muddy two unrelated authentication models.

**Decision:** New `sentryWebhookAuth` middleware mounted only at `/v1/webhooks/:tenantId/sentry`. Existing generic auth keeps its current job for non-Sentry providers.

### AD-2: Client Secret stored encrypted on the integration row, scoped by `(tenantId, provider='sentry')`

One Sentry integration per tenant. Reuse `token-encryption.port.ts`. Schema additions on the integration entity:

- `clientSecretEncrypted: string | null`
- `verified: boolean` (default `false`)
- `verifiedAt: Date | null`
- `lastEventAt: Date | null`

The first incoming webhook whose HMAC validates flips `verified=true, verifiedAt=now()` and records `lastEventAt`.

### AD-3: Trigger registration is a UI affordance only; verification is observed, not asserted

Adding a trigger row in the dashboard does not mean the user finished Sentry-side setup. The dashboard MUST show the *observed* verification status from the integration row — never trust client-side state.

- `verified=false` → show "Awaiting first event from Sentry" + a **Reopen setup instructions** button.
- `verified=true` → show "Verified — last event {relative time}".

### AD-4: Setup modal becomes always-reopenable, not a one-shot

A persistent **"Show setup instructions"** action on the Sentry card (gear icon menu or button) opens the modal at any time. The modal closes by user action only — never auto-dismisses on trigger save.

### AD-5: Modal collects the Client Secret as a required input

The dashboard cannot derive the secret. Add a `<Input type="password">` for the Client Secret in the modal, with a "Save & verify later" submit. POST to a new core endpoint `POST /v1/integrations/sentry` (tenant-scoped via JWT) which encrypts and stores it. Display masked thereafter; offer "Replace secret" to rotate.

### AD-6: Slack uses the canonical `IntegrationCard`

Remove the `type !== 'slack'` exclusion. Slack's OAuth flow plugs into the same `connect | reconnect | disconnect` button positions; the connect handler invokes the OAuth redirect. The dialog-confirmed disconnect (current Slack-only UX) is preserved as a confirmation modal triggered by the standard `Disconnect` button. `slack-settings.tsx` is deleted; its OAuth handlers move into the shared card via a `connectionStrategy: 'oauth' | 'credential' | 'webhook'` prop.

### AD-7: Fire Test Error throws inside an HTTP handler so Sentry SDK auto-captures

Replace the synthetic `ingestAlert.execute()` loop with: a route guarded by `requireRole('admin')` and `if (config.stage === 'production') return 403`, that **`throw`s** `new TestErrorFiredError(...)` from inside the request handler. Sentry's `@sentry/node` Hono integration captures it, Sentry.io receives it, Sentry then webhooks back to `/v1/webhooks/{tenantId}/sentry`. Round trip is observable in CloudWatch (`/ecs/causeflow-staging-api`).

The handler returns `202 Accepted` BEFORE throwing? No — the throw must be observable by the framework's error layer to reach the Sentry SDK. Pattern: throw inside the route, let the global error handler return a sanitized 500 to the dashboard. Dashboard treats 500 with a known marker as success ("Test error fired — check Sentry"). Alternative: keep returning 202 but use `Sentry.captureException` + a synthetic error. **Recommendation: actually throw**, because the user explicitly wants "thrown an error that will be captured by Sentry," and synthesized captures don't exercise the real exception pipeline.

### AD-8: The Next.js proxy `/api/admin/fire-test-errors` must forward Clerk auth + tenant context

Confirm route exists at `web/apps/dashboard/src/app/api/admin/fire-test-errors/route.ts`. If missing or broken, create/repair it: read Clerk session, mint a server-to-core JWT (or pass through), call `${CORE_API_URL}/admin/fire-test-errors` with `Authorization: Bearer <token>`, propagate response status. This is likely the silent failure the user is hitting.

### AD-9: Codify the testing protocol in CLAUDE.md (durable rule)

Add to `web/apps/dashboard/CLAUDE.md` (and import-by-reference from `web/CLAUDE.md`) a **"Verification Protocol for Dashboard Changes"** section:

- Always verify via Playwright (`playwright codegen` or scripted) against staging URL `https://dashboard-staging.causeflow.ai`.
- Always tail core logs in parallel: `aws logs tail /ecs/causeflow-staging-api --follow`.
- Local-against-staging: copy `web/apps/dashboard/.env.staging` → `.env.local`, then `pnpm dev`.
- For Sentry-related changes: ask the user to perform the manual Sentry-side setup before declaring done.
- Every dashboard PR adds or extends a Playwright E2E covering the changed flow.

---

## Security Boundaries

- **Tenant isolation (W4 mirror of core).** `tenantId` for the Sentry integration is taken from Clerk `org_id` server-side. The webhook URL's `:tenantId` segment is *cross-checked* against the stored integration row — a mismatch returns 404 (don't leak that the row exists for a different tenant).
- **Client Secret at rest.** Encrypted via `token-encryption.port.ts`. Never logged. Pino redaction list extended: `body.clientSecret`, `reqBody.clientSecret`, `query.clientSecret`, `*.clientSecret`.
- **Constant-time HMAC compare.** `crypto.timingSafeEqual` (already used in existing `webhookAuth`).
- **Rate limit** the webhook endpoint at the existing global limit; no Sentry-specific bypass.
- **Fire-test-error gating.** `if (config.stage === 'production') return 403` — already enforced. Keep. Plus `requireRole('admin')`.
- **No client secret in logs / error messages / responses.** After save, GET integration returns `hasClientSecret: true` only.

---

## Data Model Changes

**Backend (`core`)** — extend the integration entity:

```ts
// shape (final names per existing ElectroDB / Drizzle conventions in core)
{
  tenantId: string;
  provider: 'sentry'; // existing values preserved
  clientSecretEncrypted: string | null;  // NEW
  verified: boolean;                     // NEW (default false)
  verifiedAt: Date | null;               // NEW
  lastEventAt: Date | null;              // NEW
  // ...existing fields preserved
}
```

Migration is non-destructive (additive). Existing rows default to `verified=false, lastEventAt=null` (forces re-verification on first webhook — acceptable, matches the "we don't actually know they're set up" reality).

---

## API Contracts (new + changed)

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/v1/integrations/sentry` | Clerk JWT, tenant from `org_id` | Save (or replace) Client Secret. Body: `{ clientSecret: string }`. Response: `{ verified: false, hasClientSecret: true }`. |
| `GET` | `/v1/integrations/sentry` | Clerk JWT | Fetch status. Response: `{ verified, verifiedAt, lastEventAt, hasClientSecret, triggers: [...] }`. Never returns the secret. |
| `POST` | `/v1/webhooks/:tenantId/sentry` | `sentryWebhookAuth` middleware | Validates `Sentry-Hook-Signature` against the integration's stored secret. On first valid hit: flips `verified=true, verifiedAt=now()`. Always updates `lastEventAt`. |
| `POST` | `/admin/fire-test-errors` | `requireRole('admin')` + non-production | Now actually `throw`s inside the handler. Returns 500 with `{ error: 'TestErrorFired', traceId }`. |

Frontend new API client methods:

- `coreApi.saveSentryClientSecret(secret: string): Promise<{ hasClientSecret: boolean }>`.
- `coreApi.getSentryIntegrationStatus(): Promise<SentryIntegrationStatus>`.
- `coreApi.fireTestError(): Promise<{ triggered: boolean; traceId: string }>` (treats 5xx with known body as success).

---

## Sprint Decomposition

5 sprints, sized 30–90 min agent work each. Strict dependency: S1 → S2; S3, S4 independent of S1/S2; S5 depends on all.

### Sprint 01 — Backend: Sentry HMAC verification + integration secret storage

**Files to create:**
- `core/src/modules/integration/infra/middleware/sentry-webhook-auth.middleware.ts`
- `core/src/modules/integration/application/save-sentry-client-secret.usecase.ts`
- `core/src/modules/integration/application/get-sentry-integration-status.usecase.ts`
- `core/src/modules/integration/infra/integration.routes.ts` (new `/v1/integrations/sentry` routes)
- `core/tests/unit/modules/integration/sentry-webhook-auth.middleware.test.ts`
- `core/tests/unit/modules/integration/save-sentry-client-secret.usecase.test.ts`

**Files to modify:**
- The existing integration repository (locate via `grep -rn "IntegrationRepository\|integration.entity" core/src`) — add the four new fields and the encrypt/decrypt of `clientSecret`.
- `core/src/modules/ingestion/infra/webhook.routes.ts` — branch the `:provider === 'sentry'` route to use `sentryWebhookAuth` instead of generic `webhookAuth`. On verified handler, `await integrationRepo.markVerified(tenantId)` and `markEventReceived(tenantId)`.
- `core/src/app.ts` — register the new integration routes.
- `core/src/shared/infra/logger.ts` — add `'body.clientSecret'`, `'*.clientSecret'` to redaction list.
- `core/INVARIANTS.md` — add invariant **I8: Sentry webhooks require valid HMAC** with a verifier script.

**Acceptance criteria:**
- Unit test: HMAC computed with stored `clientSecret` against raw body matches `Sentry-Hook-Signature` → 200.
- Unit test: tampered body or wrong secret → 401, `verified` unchanged.
- Unit test: `tenantId` URL segment ≠ JWT-derived tenant → 404.
- Unit test: first valid hit flips `verified=false → true`, sets `verifiedAt`.
- `pnpm lint-invariants` passes (I8 present + verifier OK).

### Sprint 02 — Dashboard: Sentry setup modal + Client Secret + verified status

**Files to create:**
- `web/apps/dashboard/src/contexts/integrations/presentation/components/sentry-setup-modal.tsx` (or replace existing modal — locate during execution).
- `web/apps/dashboard/src/contexts/integrations/presentation/components/sentry-status-pill.tsx`.
- `web/apps/dashboard/src/app/api/integrations/sentry/route.ts` (Next.js proxy → core).

**Files to modify:**
- The Sentry-specific dashboard component (locate via `find web/apps/dashboard/src -iname "*sentry*"`). Add: (a) full step-by-step Sentry setup instructions matching the user-provided text — Settings → Integrations → Create New Integration → **Internal Integration** → set Webhook URL → grant Issue & Event read + Webhook read → subscribe `created`, `resolved`, `assigned`, `archived`, `unresolved` → Save. (b) Required Client Secret password input with "Save & verify" submit. (c) Persistent "Show setup instructions" entry point. (d) Verified status pill ("Awaiting first event" vs "Verified — last event {time}").
- `web/apps/dashboard/src/contexts/integrations/domain/types.ts` — add `SentryIntegrationStatus`.
- `web/apps/dashboard/src/lib/api/core-api-client.ts` — add `saveSentryClientSecret`, `getSentryIntegrationStatus`.

**Acceptance criteria:**
- Visual: modal shows the full 5-event subscription list and the Internal Integration selection.
- Functional: submitting the secret POSTs `/api/integrations/sentry` and shows "Awaiting first event" pill.
- Functional: card shows persistent "Show setup instructions" affordance — modal reopens after dismissal.
- Functional: card status pill flips to "Verified" after the integration row's `verified=true` (verified via mocked API in tests; manual verification on staging by user).

### Sprint 03 — Dashboard: Slack uses the canonical IntegrationCard

**Files to delete:**
- `web/apps/dashboard/src/contexts/integrations/presentation/components/slack-settings.tsx`.

**Files to modify:**
- `web/apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx` — remove `type !== 'slack'` exclusion. Add `connectionStrategy: 'oauth' | 'credential' | 'webhook'` prop. For `oauth`: connect → call `slackOAuthHandler.beginConnect()`; disconnect → confirm dialog (preserved from old slack-settings) → `slackOAuthHandler.disconnect()`.
- `web/apps/dashboard/src/contexts/integrations/api/slack-oauth-handler.ts` — surface `beginConnect()` and `disconnect()` exports if they are not already public.
- The integrations page — drop the Slack-specific render branch; render Slack via the same loop as other integrations.

**Acceptance criteria:**
- Visual: Slack card now matches GitHub/Sentry/AWS card layout.
- Functional: connect button starts OAuth redirect.
- Functional: disconnect button shows confirmation dialog (preserved UX).

### Sprint 04 — Fire Test Error end-to-end

**Files to create:**
- `web/apps/dashboard/src/app/api/admin/fire-test-errors/route.ts` (only if missing).

**Files to modify:**
- `core/src/modules/ingestion/infra/admin.routes.ts` — replace handler body. Inside the route, after auth + non-prod check, `throw new TestErrorFiredError('Manual fire-test-error: ${name}')`. Add `TestErrorFiredError` class so the global error handler returns a stable shape (`{ error: 'TestErrorFired', traceId }`) and Sentry's Hono integration captures the original `Error`.
- `web/apps/dashboard/src/contexts/settings/presentation/components/fire-test-errors-card.tsx` — treat 5xx with `error: 'TestErrorFired'` as success ("Test error fired. Check Sentry, then your `/dashboard/integrations` Sentry card should flip to Verified within a minute.").
- The Next.js proxy route — verify Clerk session is forwarded as `Authorization: Bearer <token>` to core.

**Acceptance criteria:**
- Manual: clicking Fire Test Error on staging:
  1. `aws logs tail /ecs/causeflow-staging-api --follow` shows the thrown error captured by Sentry.
  2. Sentry.io shows the issue.
  3. Sentry then POSTs to `/v1/webhooks/{tenantId}/sentry`.
  4. Logs show successful HMAC verify + `markVerified`.
  5. Dashboard's Sentry card flips to "Verified".
- Unit test (core): handler throws `TestErrorFiredError` and is captured by a mocked Sentry transport.
- Unit test (dashboard): card treats `500 + error: 'TestErrorFired'` as success.

### Sprint 05 — E2E + CLAUDE.md verification protocol

**Files to create:**
- `web/tests/e2e/dashboard/integrations-sentry-setup.spec.ts` — opens modal, fills Client Secret, asserts "Awaiting first event", reopens modal after dismiss.
- `web/tests/e2e/dashboard/integrations-slack-card.spec.ts` — asserts Slack card matches the canonical `IntegrationCard` layout, has the same buttons in the same positions, disconnect shows the confirmation dialog.
- `web/tests/e2e/dashboard/settings-fire-test-error-roundtrip.spec.ts` — clicks Fire Test Error, asserts UI reflects success, polls `getSentryIntegrationStatus` until `verified=true` (skipped on local; gated by `process.env.E2E_TARGET === 'staging'`).

**Files to modify:**
- `web/apps/dashboard/CLAUDE.md` — add **Verification Protocol** section (Playwright + AWS log tail + manual Sentry config requests + always-add-an-E2E rule).
- `web/CLAUDE.md` — link to the dashboard CLAUDE.md protocol; note CLAUDE.md is the source of truth for verification rules.
- `web/tests/e2e/dashboard/settings-fire-test-errors.spec.ts` — keep the existing happy-path test; ensure it still passes.

**Acceptance criteria:**
- All three new E2Es pass locally against the dashboard with mocked core.
- Two of three (Sentry setup + Slack card) also pass on staging.
- Round-trip E2E passes on staging when run by an authenticated test user (it's gated by env).
- Both CLAUDE.md files updated.

---

## INVARIANTS

Add to `core/INVARIANTS.md`:

```markdown
## I8 — Sentry webhooks require valid HMAC
- **Owner:** core/src/modules/integration
- **Preconditions:** Caller is Sentry, has the integration's `clientSecret`, signs raw body with HMAC-SHA256.
- **Postconditions:** First valid hit flips `verified=true, verifiedAt=now()`; every valid hit updates `lastEventAt`.
- **Invariants:** `/v1/webhooks/:tenantId/sentry` MUST reject any request lacking a valid `Sentry-Hook-Signature` matching the integration row's `clientSecret`. URL `:tenantId` MUST match the stored integration's `tenantId` or 404.
- **Verify:** `pnpm tsx infra/scripts/check-invariants.ts --invariant I8` (greps for `sentryWebhookAuth` mount and asserts the route uses it; fails if the route is mounted with the generic `webhookAuth`).
- **Fix:** Re-mount `/v1/webhooks/:tenantId/sentry` with `sentryWebhookAuth`.
```

Add to `web/INVARIANTS.md` (or create if absent):

```markdown
## W5 — Slack must render through the canonical IntegrationCard
- **Owner:** web/apps/dashboard/src/contexts/integrations/presentation
- **Invariants:** No component renders a Slack-specific card outside `IntegrationCard`. The substring `type !== 'slack'` MUST NOT appear in `integration-card.tsx`.
- **Verify:** `! grep -q "type !== 'slack'" web/apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx`.
- **Fix:** Remove the exclusion; route Slack through the shared card with `connectionStrategy='oauth'`.
```

---

## Verification Plan (end-to-end, executable by /plan-build-test)

1. **Local typecheck + unit tests:** `cd core && pnpm test:run` and `cd web && pnpm test`.
2. **Local lint + invariants:** `cd core && pnpm lint && pnpm lint-invariants`.
3. **Local dev sanity:**
   - `cd core && pnpm dev`.
   - `cp web/apps/dashboard/.env.staging web/apps/dashboard/.env.local && cd web && pnpm dev`.
   - Playwright: navigate `/dashboard/integrations`, open Sentry setup modal, verify the new copy + Client Secret input.
4. **Local E2E:** `cd web && pnpm test:e2e -- integrations-sentry-setup.spec.ts integrations-slack-card.spec.ts`.
5. **Staging verification (requires user manual steps — see §Manual user steps):**
   - Tail core logs in one terminal: `aws logs tail /ecs/causeflow-staging-api --follow`.
   - User performs Sentry-side Internal Integration creation, pastes Webhook URL `https://api-staging.causeflow.ai/v1/webhooks/{orgId}/sentry`, grants permissions, subscribes the 5 issue events, copies Client Secret.
   - User pastes Client Secret into dashboard modal, submits.
   - User clicks Fire Test Error on Settings.
   - Logs must show: throw captured → Sentry SDK send → Sentry webhook arrival → HMAC verify pass → `markVerified` set.
   - Dashboard Sentry card shows "Verified — last event just now".
6. **Round-trip E2E on staging:** `E2E_TARGET=staging pnpm test:e2e -- settings-fire-test-error-roundtrip.spec.ts`.

---

## Manual user steps (the user must do these — agent will pause and ask)

1. **Create Sentry Internal Integration** on staging:
   - Sentry → Settings → Integrations → Create New Integration → **Internal Integration**.
   - Webhook URL: `https://api-staging.causeflow.ai/v1/webhooks/{your-clerk-org-id}/sentry` (the dashboard modal will display the exact value).
   - Permissions: Issue & Event = **Read**; Webhooks = **Read**.
   - Webhook subscriptions (issue): `created`, `resolved`, `assigned`, `archived`, `unresolved`.
   - Save → copy Client Secret.
2. **Paste Client Secret** into the dashboard's Sentry setup modal, save.
3. **Click Fire Test Error** on `/dashboard/settings`.
4. **Confirm** that the Sentry card flipped to "Verified" within ~60 s. Report back.

---

## Open questions for user (asked via AskUserQuestion before exiting plan mode)

1. For Fire Test Error: should the core handler **actually `throw`** (stronger E2E proof, returns 500 to dashboard) — recommended — or use `Sentry.captureException(new Error(...))` + return 202 (cleaner UX, slightly weaker E2E)?
2. Do we need to support **multiple Sentry integrations per tenant** (e.g., one per Sentry project), or is one-per-tenant correct? The URL shape `/v1/webhooks/{tenantId}/sentry` implies one — confirm.
3. Slack disconnect today shows a confirmation dialog. Keep that dialog when we move to the canonical card, or accept the simpler one-click disconnect that other integrations use?
4. Existing Sentry integrations in staging will all become `verified=false` after this migration (no historical signal). Is that acceptable, or do we need a one-time backfill that flips them to `verified=true` based on `lastEventAt` from logs?

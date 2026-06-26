# PRD: Dashboard Integration Hardening + Test-Error Round-Trip

**Status:** Approved 2026-04-27 — pending execution via `/plan-build-test` in a fresh session.
**Mode:** PRD + Sprint (cross-repo: `web/apps/dashboard` + `core`, 5 sprints).
**Source plan:** `/root/.claude/plans/there-are-some-issues-melodic-dove.md` (this is a copy with execution metadata).

---

## Cross-repo coordination

Per `/root/projects/causeflow/CLAUDE.md`: this PRD spans **two independent git repos**. Coordinate by deploy order:

1. `core/` (backend) — Sprint 01, partial Sprint 04 (the `throw` change in `admin.routes.ts`).
2. `web/apps/dashboard/` (frontend) — Sprints 02, 03, partial Sprint 04 (proxy + card), Sprint 05 (E2E + CLAUDE.md).

Two PRs total: one to the `core` repo, one to the `web` repo. Deploy `core` first; then `web`.

---

## Context

Three production-visible bugs in the staging dashboard, plus a documented testing-discipline gap that caused them. The user discovered each bug by clicking through the staging dashboard — **none** were caught by automated tests, because none exist for these flows. Fix the bugs *and* close the verification loop so future regressions surface in CI.

### The bugs

1. **Sentry integration: incomplete setup + no proof of life.** The setup-instructions modal walks users through Sentry → Settings → Integrations but does not describe selecting **Internal Integration**, granting **Issue & Event read** + **Webhook read**, or subscribing to the five issue events (`created`, `resolved`, `assigned`, `archived`, `unresolved`). After the user adds the trigger, the dashboard shows **Triggers (1) — SENTRY_NEW_ISSUE registered** but the system has no way to know whether the user actually completed the Sentry-side setup. The modal becomes unreachable, so a misconfigured user has no recovery path.

   Sentry's Internal Integration emits a **Client Secret** (e.g. `e0147e7…`) that signs every webhook with `Sentry-Hook-Signature`. Today the core webhook middleware (`webhook-auth.middleware.ts`) only accepts `X-Webhook-Signature` and looks up the secret via `X-API-Key`. Sentry sends neither header — so even if the user pastes our URL correctly, the request 401s. There is **no per-integration client-secret storage** and **no `verified` flag** on the integration row.

2. **Slack card looks different from every other integration.** `integration-card.tsx` is the canonical card. It explicitly excludes Slack (`type !== 'slack'`). Slack is rendered by a custom `slack-settings.tsx` with a dialog-confirmed disconnect link instead of the shared button bar.

3. **"Fire Test Error" button doesn't reach Sentry.** The button on `/dashboard/settings` POSTs to `/api/admin/fire-test-errors`, which is wired to core's `POST /admin/fire-test-errors`. The core handler simulates Sentry payloads by calling `ingestAlert.execute()` directly — it never `throw`s an error inside the request, so the core's Sentry SDK never captures, Sentry.io never receives, and Sentry never calls our webhook back.

### The testing-discipline gap

User explicitly called out: "A lot of issues happened, because it wasn't tested." The **Verification Protocol** added to `web/apps/dashboard/CLAUDE.md` codifies the future-task expectations (Playwright + AWS log tail + manual-step asks + always-add-an-E2E).

### Non-goals

- Not redesigning the integrations page.
- Not adding new Sentry trigger types beyond `SENTRY_NEW_ISSUE`.
- Not multi-Sentry-integration-per-tenant (one per tenant — confirmed).
- Not webhook-secret rotation UX.

---

## Decisions (user-confirmed)

1. **Fire Test Error**: handler **actually `throw`s** inside the HTTP request. Sentry SDK auto-captures, Sentry webhooks back. Dashboard treats `500 + { error: 'TestErrorFired' }` as success.
2. **One Sentry integration per tenant** (matches webhook URL shape).
3. **Slack disconnect** keeps the confirmation dialog when moving to canonical card.
4. **Migration**: existing rows reset to `verified=false`; first valid HMAC-signed webhook flips them. No backfill.

---

## Context Loaded

**Backend (`core/`):**
- `core/src/modules/ingestion/infra/webhook.routes.ts` — `POST /:tenantId/:provider`, mounted at `/v1/webhooks` in `core/src/app.ts:100`.
- `core/src/shared/infra/http/middleware/webhook-auth.middleware.ts` — current HMAC verifier (expects `X-Webhook-Signature`).
- `core/src/modules/ingestion/infra/parsers/sentry.parser.ts` — already parses `{ action, data.issue }`.
- `core/src/modules/ingestion/infra/admin.routes.ts` — `POST /admin/fire-test-errors` (exists, but doesn't `throw`).
- `core/src/shared/infra/observability/sentry.ts` — Sentry SDK init (`SENTRY_DSN`).
- `core/src/shared/application/ports/token-encryption.port.ts` — encryption port for at-rest secrets (reuse).
- `core/INVARIANTS.md` — I1–I7. New I8 added by Sprint 01.

**Frontend (`web/apps/dashboard/`):**
- `web/apps/dashboard/src/contexts/integrations/presentation/pages/integrations-page.tsx`.
- `web/apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx` (status enum: `available | connected | error | disconnected`; explicitly excludes Slack at `type !== 'slack'`).
- `web/apps/dashboard/src/contexts/integrations/presentation/components/slack-settings.tsx` (to be deleted in Sprint 03).
- `web/apps/dashboard/src/contexts/integrations/domain/types.ts`.
- Sentry-specific component (locate in Sprint 02 via `find … -iname "*sentry*"` under the dashboard).
- `web/apps/dashboard/src/contexts/settings/presentation/components/fire-test-errors-card.tsx`.
- `web/apps/dashboard/src/lib/api/{core-api-client,http-api-client}.ts`.
- `web/playwright.config.ts`, `web/tests/e2e/dashboard/`.
- `web/apps/dashboard/.env.staging` (staging credentials).

**Reusable (do NOT re-implement):**
- `token-encryption.port.ts` for at-rest encryption.
- `webhookAuth` skeleton — copy patterns; do not extend it (see AD-1).
- `IntegrationCard` — Slack must use it, not a parallel component.
- `requireRole`, `c.get('tenantId')` from existing routes.

---

## Architecture Decisions

### AD-1: Sentry webhook auth is a *route-scoped* middleware, not an extension of `webhookAuth`
Sentry's signature scheme differs (different header, no `sha256=` prefix, no `X-API-Key` lookup — secret is bound by URL `tenantId` + integration row's stored `clientSecret`). New `sentryWebhookAuth` middleware mounted only at `/v1/webhooks/:tenantId/sentry`.

### AD-2: Client Secret stored encrypted on the integration row, scoped by `(tenantId, provider='sentry')`
One row per tenant. New fields: `clientSecretEncrypted`, `verified` (default `false`), `verifiedAt`, `lastEventAt`. Reuse `token-encryption.port.ts`. First valid HMAC hit flips `verified=true, verifiedAt=now()`; every valid hit updates `lastEventAt`.

### AD-3: Trigger registration is a UI affordance only; verification is observed
Adding a trigger row in the dashboard does not mean Sentry-side setup is done. Dashboard MUST show observed status from the integration row.
- `verified=false` → "Awaiting first event from Sentry" + Reopen-instructions button.
- `verified=true` → "Verified — last event {relative time}".

### AD-4: Setup modal is always reopenable
Persistent **"Show setup instructions"** action on the Sentry card opens the modal at any time. Modal closes by user action only.

### AD-5: Modal collects the Client Secret as a required input
`<Input type="password">` for the Client Secret. POST to `POST /v1/integrations/sentry` (tenant-scoped via Clerk JWT). Display masked thereafter; "Replace secret" rotates.

### AD-6: Slack uses the canonical `IntegrationCard`
Remove `type !== 'slack'` exclusion. Add `connectionStrategy: 'oauth' | 'credential' | 'webhook'` prop. OAuth strategy: connect → `slackOAuthHandler.beginConnect()`; disconnect → confirmation dialog → `slackOAuthHandler.disconnect()`. Delete `slack-settings.tsx`.

### AD-7: Fire Test Error throws inside an HTTP handler
After auth + non-prod check, `throw new TestErrorFiredError(...)`. Sentry's Hono integration auto-captures. Global error handler returns `500 { error: 'TestErrorFired', traceId }`. Dashboard treats that shape as success.

### AD-8: Next.js proxy `/api/admin/fire-test-errors` forwards Clerk auth to core
Confirm `web/apps/dashboard/src/app/api/admin/fire-test-errors/route.ts` exists; create/repair if missing. Read Clerk session; forward as `Authorization: Bearer <token>` to `${CORE_API_URL}/admin/fire-test-errors`. **This is the most likely root cause of the user-reported "button doesn't call backend"** — confirm first thing in Sprint 04.

### AD-9: Verification Protocol codified in CLAUDE.md
- Playwright against `https://dashboard-staging.causeflow.ai`.
- `aws logs tail /ecs/causeflow-staging-api --follow` running in parallel during verification.
- Local-against-staging: copy `.env.staging` → `.env.local`, then `pnpm dev`.
- For Sentry-related changes: ask user to perform manual Sentry-side setup before declaring done.
- Every dashboard PR adds or extends a Playwright E2E.

---

## Security Boundaries

- **Tenant isolation.** `tenantId` for save/get-status comes from Clerk `org_id` server-side. Webhook URL `:tenantId` is cross-checked against the stored row — mismatch → 404 (don't leak existence).
- **Client Secret at rest.** Encrypted via `token-encryption.port.ts`. Never logged. Pino redaction extended: `body.clientSecret`, `reqBody.clientSecret`, `query.clientSecret`, `*.clientSecret`.
- **Constant-time HMAC compare.** `crypto.timingSafeEqual` (already used in existing `webhookAuth`).
- **Rate limit** the webhook endpoint at the existing global limit; no Sentry-specific bypass.
- **Fire-test-error gating.** `if (config.stage === 'production') return 403` (kept) plus `requireRole('admin')`.
- **No client secret in responses.** GET integration returns `hasClientSecret: true` only.

---

## Data Model Changes

Backend integration entity adds:

```ts
clientSecretEncrypted: string | null;  // NEW
verified: boolean;                     // NEW (default false)
verifiedAt: Date | null;               // NEW
lastEventAt: Date | null;              // NEW
```

Migration is non-destructive (additive). Existing Sentry rows reset to `verified=false, lastEventAt=null` (matches reality — we never knew they were configured correctly).

---

## API Contracts

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/v1/integrations/sentry` | Clerk JWT | Save (or replace) Client Secret. Body: `{ clientSecret: string }`. Response: `{ verified: false, hasClientSecret: true }`. |
| `GET` | `/v1/integrations/sentry` | Clerk JWT | Status. Response: `{ verified, verifiedAt, lastEventAt, hasClientSecret, triggers: [...] }`. Never returns the secret. |
| `POST` | `/v1/webhooks/:tenantId/sentry` | `sentryWebhookAuth` | HMAC-verifies via stored secret. First valid hit flips `verified=true, verifiedAt=now()`. Always updates `lastEventAt`. |
| `POST` | `/admin/fire-test-errors` | `requireRole('admin')` + non-production | Throws inside handler. Returns `500 { error: 'TestErrorFired', traceId }`. |

Frontend additions to `core-api-client.ts`:
- `saveSentryClientSecret(secret: string): Promise<{ hasClientSecret: boolean }>`
- `getSentryIntegrationStatus(): Promise<SentryIntegrationStatus>`
- `fireTestError(): Promise<{ triggered: boolean; traceId: string }>` (treats 5xx with `error: 'TestErrorFired'` as success).

---

## Sprint Map

| # | Title | Repo | Files (high level) | Depends on |
|---|---|---|---|---|
| 01 | Backend: Sentry HMAC verification + integration secret storage | `core` | new middleware, usecases, route module; modify webhook.routes, app.ts, logger.ts, INVARIANTS.md | — |
| 02 | Dashboard: Sentry setup modal + Client Secret input + verified status | `web` | new modal, status pill, Next.js proxy; modify Sentry component, types, api-client | 01 |
| 03 | Dashboard: Slack uses canonical IntegrationCard | `web` | delete slack-settings.tsx; modify integration-card.tsx, slack-oauth-handler.ts, integrations-page.tsx | — |
| 04 | Fire Test Error end-to-end | both | maybe new Next.js proxy; modify admin.routes.ts (core), fire-test-errors-card.tsx (web) | — |
| 05 | E2E + CLAUDE.md verification protocol | `web` | new Playwright tests; CLAUDE.md updates | 01–04 |

Sprint specs are in `sprints/`. Each is self-contained — sprint-executor reads ONLY its own spec.

---

## Verification Plan

1. **Local typecheck + unit:** `cd core && pnpm test:run`; `cd web && pnpm test`.
2. **Local lint + invariants:** `cd core && pnpm lint && pnpm lint-invariants`.
3. **Local dev sanity:** `cd core && pnpm dev`; `cp web/apps/dashboard/.env.staging web/apps/dashboard/.env.local && cd web && pnpm dev`. Playwright check the integrations page modal and Slack card visual parity.
4. **Local E2E:** `cd web && pnpm test:e2e -- integrations-sentry-setup.spec.ts integrations-slack-card.spec.ts`.
5. **Staging verification (manual user steps below + log tail):** clicking through Fire Test Error must show throw → Sentry SDK send → webhook arrival → HMAC verify → `markVerified` → dashboard pill flip.
6. **Round-trip E2E on staging:** `E2E_TARGET=staging pnpm test:e2e -- settings-fire-test-error-roundtrip.spec.ts`.

---

## Manual user steps

1. **Create Sentry Internal Integration** on staging Sentry org:
   - Sentry → Settings → Integrations → Create New Integration → **Internal Integration**.
   - Webhook URL: `https://api-staging.causeflow.ai/v1/webhooks/{your-clerk-org-id}/sentry` (the dashboard modal will show the exact value).
   - Permissions: Issue & Event = **Read**; Webhooks = **Read**.
   - Webhook subscriptions (issue): `created`, `resolved`, `assigned`, `archived`, `unresolved`.
   - Save → copy Client Secret.
2. **Paste Client Secret** into the dashboard's Sentry setup modal, save.
3. **Click Fire Test Error** on `/dashboard/settings`.
4. **Confirm** the Sentry card flips to "Verified" within ~60 s. Report back to the agent.

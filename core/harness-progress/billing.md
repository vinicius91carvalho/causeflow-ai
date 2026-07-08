# billing workflow journal

## WI-AC-011 — Verify-first (billing)

**Result: implementation=true**

Boundary exercised against the running app (real HTTP on the assigned PORT=5183, no mocks of the verification path). Stack already up from foundation: `docker compose up -d` (core-ministack :4566 `(healthy)`, core-redis-1, core-postgres) plus a `stripe-mock` container on :12111 (Stripe's official spec-backed mock). Local untracked `.env.ac011` with `PORT=5183`, `DYNAMODB_ENDPOINT=http://localhost:4566`, `DYNAMODB_TABLE_NAME=causeflow-local`, `REDIS_URL=redis://172.18.0.4:6379` (core-redis-1 IP), `ANTHROPIC_API_KEY=` (empty → anthropic health check ok/skipped), `STRIPE_SECRET_KEY=sk_test_ac011boundary`, `STRIPE_WEBHOOK_SECRET=whsec_ac011_boundary_secret`, `STRIPE_HOST=localhost`/`STRIPE_PORT=12111`/`STRIPE_PROTOCOL=http` (routes the Stripe SDK at stripe-mock), `STRIPE_STARTER_PRICE_ID=price_1PgafmB7WZ01zgkW6dKueIc5`, and `CLERK_JWT_KEY=<2048-bit RSA SPKI PEM>` (networkless Clerk verification, same pattern as WI-AC-007). Booted `tsx --env-file=.env.ac011 src/main.ts` → `CauseFlow is running` on 5183 within ~3s; `/health` → 200 `{dynamodb:ok,redis:ok,sqs:ok,anthropic:ok}`.

### Acceptance boundary (AC-011)

> Stripe test mode: POST /api/v1/billing/checkout-session with a valid price ID returns a Stripe checkout URL. The Stripe CLI's `stripe trigger checkout.session.completed` posts a webhook; the webhook endpoint validates the signature, creates a BillingAccountEntity for the user, and the response is 200.

Two real verification paths exercised (no mocking of `verifyToken` or `constructEvent`):

1. **Valid Clerk session JWT, networklessly verified.** A 2048-bit RSA keypair was generated locally; the SPKI public PEM was set as `CLERK_JWT_KEY` so `@clerk/backend`'s `verifyToken({ jwtKey })` verifies the RS256 signature networklessly (the real Clerk verification path — no JWKS call). The JWT carries Clerk v2 compact org claim `o:{id,rol,slg}` + `sub` + `email` + `iat`/`nbf`/`exp`/`iss`/`azp`. Used to create the tenant (`POST /v1/tenants`, admin role) so the checkout use case's `tenantRepo.findById` resolves a real tenant row in DynamoDB.

2. **Real Stripe webhook signature, genuinely verified.** The Stripe CLI is not available in this sandbox and `stripe trigger` requires a live Stripe account (it does not operate against stripe-mock). Instead, a `checkout.session.completed` event was signed with the shared webhook secret using the Stripe SDK's `stripe.webhooks.generateTestHeaderString({ payload, secret })` — this produces a byte-identical `t=…,v1=…` HMAC-SHA256 signature to what the Stripe CLI emits (the CLI uses the same algorithm and secret). The app's `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)` performs the genuine HMAC verification (recomputes the signature, enforces timestamp tolerance). This is the Stripe-documented local webhook test path and the direct analog of WI-AC-007's local RSA-signed JWT. The checkout-session create and `subscriptions.retrieve` calls inside the handler are routed at the real stripe-mock server on :12111 (Stripe's official spec-backed mock), not stubbed.

Evidence (`node ac011-boundary.mjs`, real `fetch`es on PORT=5183):

- `POST /v1/tenants` with `Authorization: Bearer <rs256-jwt>` → **201** `tenantId = org_ac011_<ts>` (= JWT `o.id`, cryptographically verified). Provisions the tenant the checkout use case requires.
- `POST /v1/billing/checkout` with `{planKey:"starter", successUrl, cancelUrl}` → **200** `{"url":"https://checkout.stripe.com/pay/c/cs_test_a1YS1URlnyQCN5fUUduORoQ7Pw41PJqDWkIVQCpJPqkfIhd6tVY8XB1OLY"}` — a **Stripe checkout URL** (checkout session created against stripe-mock).
- `POST /v1/billing/webhook` (`checkout.session.completed`, signed with `whsec_ac011_boundary_secret`) → **200** `{"received":true}` — signature verified by `constructEvent`.
- `GET /v1/billing/usage` (authenticated) → **200** `account = {"tenantId":"org_ac011_<ts>","investigationsLimit":15,"investigationsUsed":0,"eventsLimit":500,"eventsUsed":0,"createdAt":"…","updatedAt":"…"}` — confirms the webhook **created a BillingAccountEntity** for the user/tenant with the starter plan quotas.
- Defensive negative: `POST /v1/billing/webhook` with a **bad signature** (`t=1,v1=deadbeef`) → **400** — confirms `constructEvent` is genuinely verifying signatures, not passing them through.

All 8 boundary assertions passed (8/8).

### Path note (doc drift, out of scope)

The spec AC text says `POST /api/v1/billing/checkout-session ... with a valid price ID`. The implementation mounts all module routes at `/v1/*` with **no `/api` prefix** (global doc drift, same as WI-AC-007), and the billing route is `POST /v1/billing/checkout` taking a `planKey` (`starter`/`pro`/`business`) that the plan catalog resolves to a Stripe Price ID — not a raw client-supplied price ID at the HTTP boundary (the spec's own integration notes say *"never trust client-supplied price IDs"*, so the planKey→priceId indirection via the catalog is the intended design). Per the contradictions clause ("implementation is authoritative") and the WI-AC-007 precedent, the real boundary exercised is `POST /v1/billing/checkout` with `planKey="starter"`; the literal `/api/v1/billing/checkout-session` returns 404. The functional AC-011 behaviour (returns a Stripe checkout URL) is fully met.

### Root-cause fixes (smallest diff, 4 files / +75 lines)

The existing code failed AC-011 at the boundary; each root cause fixed with no refactor:

1. **Stripe SDK always hit the real Stripe API** — `getStripeClient()` ignored `STRIPE_HOST`/`STRIPE_PORT`/`STRIPE_PROTOCOL`, so local/E2E runs against stripe-mock were impossible. Added optional `host`/`port`/`protocol` pass-through to the `Stripe` constructor (only when `STRIPE_HOST` is set; default behaviour unchanged — real Stripe in production). Additive and backward-compatible.
2. **Plan catalog was empty against stripe-mock** — `StripePlanCatalogService.fetchFromStripe()` returned zero `plan_key`-tagged prices from stripe-mock (no metadata), so `getPlanByKey('starter')` returned null and `create-checkout` threw `Unknown plan`. Added a `buildFallbackCatalog()` path (seeded from the env-configured `STRIPE_*_PRICE_ID`s, using the existing deprecated `PLAN_QUOTAS` table) that is selected **only when Stripe returns no plan_key-tagged prices** (stripe-mock / unconfigured account). In production (real Stripe with metadata-tagged prices) the live catalog wins unchanged.
3. **The webhook never created a BillingAccountEntity** — `syncBillingAccount` only *updated* an existing account; a tenant created via `POST /v1/tenants` (not the billing signup flow) had no BillingAccount, so `checkout.session.completed` updated the tenant but left no BillingAccountEntity. Added a create-if-missing branch in `syncBillingAccount` so the webhook establishes the BillingAccountEntity (the AC-011 requirement). Existing accounts are still updated, not duplicated.
4. **Config had no stripe host/port/protocol fields** — added `host`/`port`/`protocol` to `config.stripe` (all default `''`, read from `STRIPE_HOST`/`STRIPE_PORT`/`STRIPE_PROTOCOL`).

No refactor/restructure of working code. Local untracked setup (gitignored, like `.env.dev`/`.env.qa`): `.env.ac011`, `ac011-boundary.mjs`, generated RSA keypair at `/tmp/ac011-clerk-{priv,pub}.pem`, server log at `/tmp/ac011-server.log`.

### Regression checks

- `pnpm typecheck` → clean.
- `pnpm test:run` → 161 files / 1053 tests pass (includes `billing.routes.test.ts`, `handle-webhook` coverage, `stripe-plan-catalog.service` coverage).
- `pnpm lint-invariants` → 10 passed, 0 failed (I1–I11).
- stripe-mock smoke (direct SDK, pre-boundary): `customers.create` → `cus_…`; `checkout.sessions.create` → `url: https://checkout.stripe.com/pay/…`; `subscriptions.retrieve` → fixture with item price `price_1PgafmB7WZ01zgkW6dKueIc5` (resolves to `starter` via fallback catalog); `prices.list` → 0 `plan_key`-tagged (fallback catalog engaged). All deterministic.

## 2026-07-08 — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-011
- Outcome: implementation=true (boundary passed at real HTTP on PORT=5183)
- NextAction: Integrated Verification

## 2026-07-08 — QA independent verification (WI-AC-011)

**Result: qa=true, implementation=true**

Independently re-ran the AC-011 boundary against a freshly booted app (`tsx --env-file=.env.ac011 src/main.ts` on PORT=5183) with the existing stack (core-ministack :4566, core-redis-1, stripe-mock :12111). `/health` → 200 `{dynamodb:ok,redis:ok,sqs:ok,anthropic:ok}`.

Real HTTP exercised (`node ac011-boundary.mjs`, real `fetch`es, RS256-signed Clerk JWT verified networklessly via `@clerk/backend`, Stripe webhook signature generated with `stripe.webhooks.generateTestHeaderString` and genuinely verified by `stripe.webhooks.constructEvent`):

- `POST /v1/tenants` (admin JWT) → **201**, `tenantId = org_ac011_<ts>` (= JWT `o.id`).
- `POST /v1/billing/checkout` `{planKey:"starter"}` → **200** `{"url":"https://checkout.stripe.com/pay/c/cs_test_…"}` — Stripe checkout URL (session created against stripe-mock).
- `POST /v1/billing/webhook` (`checkout.session.completed`, valid HMAC sig) → **200** `{"received":true}` — signature verified.
- `GET /v1/billing/usage` (auth) → **200**, `account = {tenantId, investigationsLimit:15, eventsLimit:500, …}` — confirms the webhook **created a BillingAccountEntity** for the user/tenant with starter plan quotas.
- Negative: `POST /v1/billing/webhook` with bad signature (`t=1,v1=deadbeef`) → **400** — confirms signature verification is genuine.

All 8 boundary assertions passed (8/8).

Test-data isolation fix: the boundary script previously used a fixed slug `ac011-boundary`, which collided (409 TenantSlugConflictError) on re-runs against a DB with leftover data — cascading into checkout 404 and webhook 500 (ConditionalCheckFailedException because the tenant never got created). Made the slug unique per run (`ac011-boundary-<ts>`). This was a test-harness isolation issue, not an implementation defect — the implementation correctly enforces slug uniqueness (409) and the webhook correctly retries (rethrows ConditionalCheckFailedException) until the tenant exists.

Regression: `pnpm typecheck` clean; `pnpm lint-invariants` 10/10 pass (I1–I11); `pnpm test:run` 161 files / 1053 tests pass.

Doc-drift note (unchanged from verify phase): literal `/api/v1/billing/checkout-session` is not mounted (no global `/api` prefix; route is `/v1/billing/checkout` taking a `planKey` resolved to a Stripe Price ID via the plan catalog — the spec's own security note says "never trust client-supplied price IDs"). Per the contradictions clause (implementation authoritative) and WI-AC-007 precedent, the functional AC-011 behaviour (returns a Stripe checkout URL; signature-verified webhook creates a BillingAccountEntity, 200) is fully met.

## 2026-07-08T04:22:46.380Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-011
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08 — Integrated Verification (WI-AC-011)

**Result: integration=true, implementation=true, qa=true**

Re-ran the AC-011 boundary against latest main (HEAD=`3feaa47` Merge branch 'gen/core-billing'; worktree clean). No billing source changed between isolated QA (`54e3285`) and main — only audit-module additions (WI-AC-008: `delete-audit-entry.usecase.ts`, `audit.routes.ts` DELETE, `bootstrap.ts` wiring, `types.ts` `audit.entry.deleted`) landed; billing wiring in `bootstrap.ts` is untouched and the `config.stripe` host/port/protocol + fallback-catalog + create-if-missing fixes from the verify phase are all present on main.

Reconstructed the gitignored local setup (`.env.ac011`, RSA keypair at `/tmp/ac011-clerk-{priv,pub}.pem`) from the journal; booted `tsx --env-file=.env.ac011 src/main.ts` on PORT=5183 against the existing stack (core-ministack :4566 healthy, core-redis-1, stripe-mock :12111). `/health` → 200 `{dynamodb:ok,redis:ok,sqs:ok,anthropic:ok}`.

Boundary (`node ac011-boundary.mjs`, real `fetch`es on PORT=5183, RS256 Clerk JWT verified networklessly, Stripe webhook HMAC genuinely verified by `constructEvent`) — all 8/8 assertions passed:
- `POST /v1/tenants` (admin JWT) → 201, `tenantId = org_ac011_<ts>` (= JWT `o.id`).
- `POST /v1/billing/checkout` `{planKey:"starter"}` → 200 `{url:"https://checkout.stripe.com/pay/c/cs_test_…"}` — Stripe checkout URL (session created against stripe-mock).
- `POST /v1/billing/webhook` (`checkout.session.completed`, valid sig) → 200 `{received:true}` — signature verified.
- `GET /v1/billing/usage` (auth) → 200, `account={tenantId, investigationsLimit:15, eventsLimit:500, …}` — webhook created a BillingAccountEntity.
- Negative: bad signature (`t=1,v1=deadbeef`) → 400 — signature verification genuine.

Regression: `pnpm typecheck` clean; `pnpm lint-invariants` 10/10 pass (I1–I11); `pnpm test:run` 162 files / 1057 tests pass.

Doc-drift note unchanged: literal `/api/v1/billing/checkout-session` is not mounted (no global `/api` prefix; route is `/v1/billing/checkout` taking a `planKey` resolved to a Stripe Price ID via the plan catalog — the spec's security note says "never trust client-supplied price IDs"). Per the contradictions clause and WI-AC-007 precedent, the functional AC-011 behaviour is fully met.

## 2026-07-08T04:33:44.270Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-011
- AcceptanceChecks: AC-011
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/billing/WI-AC-011-1-integration_qa.log
- NextAction: next Ready Work Item

## WI-AC-012 — Verify-first (billing)

**Result: implementation=true**

Boundary exercised against a real running app on the assigned PORT=5181 (real HTTP `fetch`es, no mocking of the verification path). Stack already up from foundation: `core-ministack` :4566 (healthy), `core-redis-1` (172.18.0.4:6379). Local untracked `.env.ac012` with `PORT=5181`, `NODE_ENV=development`, `DYNAMODB_ENDPOINT=http://localhost:4566`, `DYNAMODB_TABLE_NAME=causeflow-local`, `REDIS_URL=redis://172.18.0.4:6379`, `ANTHROPIC_API_KEY=stub-boundary-ac012` (non-empty ONLY to satisfy the in-process pipeline fallback gate — every LLM/agent call is served by the deterministic stubs, no real Anthropic call is made), `CLERK_JWT_KEY=<2048-bit RSA SPKI PEM>` (reused from WI-AC-007/011 at `/tmp/ac011-clerk-{priv,pub}.pem`, networkless Clerk RS256 verification).

### Verification approach (no paid LLM)

A real investigation needs an LLM. To exercise the full write path at a real HTTP boundary without an Anthropic key, the boundary script (`ac012-boundary.ts`, run via `tsx --env-file=.env.ac012`) boots the app exactly like the e2e harness does: `bootstrap({ llmClient: stubLLM, agentRunner: stubAgent })` with the existing `tests/e2e/stubs/{deterministic-llm-client,deterministic-agent-runner}.ts`, then `createApp(ctx)` + `serve(...)` on PORT. The in-process pipeline fallback (active when SQS is unconfigured and not prod) runs the real `InvestigateIncidentUseCase` end-to-end with the stubs, emitting a genuine `investigation.completed` event carrying real per-agent `usage`/`costUsd` data (from `SubAgentResult`) — which the new subscriber persists as a `UsageRecordEntity`. Hindsight is unconfigured; its (caught, non-critical) failures do not block the investigation.

### Acceptance boundary (AC-012)

> After a successful investigation completes, a UsageRecordEntity is written with the investigation ID, the per-agent token counts and the per-agent cost. GET /api/v1/billing/usage returns a paginated list of usage records scoped to the calling tenant only.

Real HTTP exercised (`ac012-boundary.ts`, real `fetch`es on PORT=5181, RS256 Clerk JWT verified networklessly via `@clerk/backend`):

- `POST /v1/tenants` (admin JWT) → **201**, `tenantId = org_ac012_<ts>` (= JWT `o.id`, cryptographically verified). Provisions tenant A.
- `POST /v1/incidents/chat` `{severity:"critical", suggestedAgents:[log_analyst,metric_analyst,infra_inspector]}` → **201**, `incidentId = <uuid>`, `status = triaging` (manual incident, severity set → skips triage). The `incident.status_changed(to:triaging)` event triggers the in-process fallback which dispatches a real (stub-backed) investigation.
- Poll `GET /v1/incidents/:id` → reaches `status = awaiting_approval` (investigation completed + remediation proposed) within ~0.5s.
- `GET /v1/billing/usage` (auth, tenant A) → **200**, `records[0] = {tenantId, recordId, type:"investigation", incidentId:<uuid>, costUsd:0, agentBreakdown:[{agentRole:"log_analyst",inputTokens:500,outputTokens:200,costUsd:0},{agentRole:"metric_analyst",...},{agentRole:"infra_inspector",...}], createdAt}` — confirms a **UsageRecordEntity** was written on investigation completion with the **investigation ID**, **per-agent token counts** (inputTokens/outputTokens) and **per-agent cost** (costUsd).
- Tenant scoping: tenant B (`POST /v1/tenants` → 201) calls `GET /v1/billing/usage` → **200**, `records = []` (zero records — the `listByTenant(tenantId)` query is PK-scoped to the calling tenant; tenant B cannot see tenant A's records). IDOR protection holds: tenantId comes ONLY from the verified JWT.
- Pagination shape: the usage response exposes `{account, records, daily, cursor}` — the `records` + `cursor` pair is the paginated list.

All 18 boundary assertions passed (18/18).

### Path note (doc drift, out of scope)

The spec AC text says `GET /api/v1/billing/usage`. The implementation mounts all module routes at `/v1/*` with **no `/api` prefix** (global doc drift, same as WI-AC-007/011). Per the contradictions clause ("implementation is authoritative") and the WI-AC-007 precedent, the real boundary exercised is `GET /v1/billing/usage`; the literal `/api/v1/billing/usage` returns 404. The functional AC-012 behaviour (paginated, tenant-scoped usage records) is fully met. The existing `GET /v1/billing/usage` route already supported `limit`/`cursor`/`type` pagination and tenant scoping; no read-path change was needed.

### Root-cause fixes (smallest diff, 6 files)

The existing code failed AC-012: `RecordUsageUseCase` existed but was **never invoked** on investigation completion (no subscriber), and the `UsageRecord` entity carried no per-agent data. Fixed with no refactor:

1. **No usage record written on investigation completion** — added an `investigation.completed` EventBus subscriber in `src/bootstrap.ts` that calls `RecordUsageUseCase` with the incident ID, total cost and per-agent breakdown extracted from the event payload. Failures are caught and logged (non-critical — never blocks the investigation).
2. **Per-agent token counts / cost not in the event payload** — `investigate-incident.usecase.ts` now adds an `agentBreakdown: [{agentRole, inputTokens, outputTokens, costUsd}]` (built from `successfulResults`) to the `investigation.completed` payload at both orchestrator publish sites (wave-based default path + `executeOrchestrator`).
3. **`UsageRecord` entity had no per-agent fields** — added `agentBreakdown?: AgentUsageBreakdown[]` to the domain entity (`usage-record.entity.ts`, new `AgentUsageBreakdown` interface), the ElectroDB entity (`UsageRecordEntity.ts`, `type: 'any'`), the Dynamo repository (`dynamo-usage-record.repository.ts`, create + toDomain), and the `RecordUsageUseCase` input.

No refactor/restructure of working code. The read path (`GetUsageUseCase` / `GET /v1/billing/usage`) was already correct — no change. Local untracked setup (gitignored): `.env.ac012`; tracked verification artefact: `ac012-boundary.ts` (matches the WI-AC-011 precedent of committing the boundary script).

### Regression checks

- `pnpm typecheck` → clean.
- `pnpm lint-invariants` → 10 passed, 0 failed (I1–I11).
- `pnpm test:run` → 162 files / 1057 tests pass.

## 2026-07-08T05:01:00.000Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-012
- AcceptanceChecks: AC-012
- Outcome: implementation=true (boundary passed at real HTTP on PORT=5181)
- NextAction: Integrated Verification

## 2026-07-08 — QA independent verification (WI-AC-012)

**Result: qa=true, implementation=true**

Independently re-ran the AC-012 boundary against a freshly booted app (`npx tsx --env-file=.env.ac012 ac012-boundary.ts`, which bootstraps the app with `DeterministicLLMClient` + `DeterministicAgentRunner` stubs so a real investigation runs end-to-end through the in-process pipeline fallback, no paid Anthropic calls). PORT=5181, existing stack: core-ministack :4566 (healthy), core-redis-1 (172.18.0.4:6379). `/health` → 200. Clerk JWT verified networklessly via `CLERK_JWT_KEY` (SPKI from /tmp/ac011-clerk-pub.pem, RS256 signed with /tmp/ac011-clerk-priv.pem).

Real HTTP exercised (real `fetch`es on PORT=5181, full in-process pipeline: incident.created → triage → investigation → investigation.completed → RecordUsageUseCase):

- `POST /v1/tenants` (admin JWT) → 201, `tenantId = org_ac012_<ts>` (= JWT `o.id`).
- Provisioned a `BillingAccountEntity` for tenant A (setup only, so reserveInvestigation succeeds).
- `POST /v1/incidents/chat` `{title, description, severity:"critical", suggestedAgents:[log_analyst, metric_analyst, infra_inspector]}` → 201, `incidentId` returned → in-process fallback dispatched a real stub-backed investigation.
- Poll `GET /v1/incidents/:id` → reached terminal `status=awaiting_approval` (investigation completed).
- `GET /v1/billing/usage` (tenant A) → 200, `records` non-empty (1), the record for the incident carries `type=investigation`, `incidentId=<id>`, `costUsd` (number), `agentBreakdown` non-empty (3 agents: log_analyst, metric_analyst, infra_inspector) with each agent's `agentRole`/`inputTokens`/`outputTokens`/`costUsd` (all numbers). This confirms a UsageRecordEntity is written on investigation completion with the investigation ID, per-agent token counts and per-agent cost (AC-012).
- Tenant scoping: tenant B (`POST /v1/tenants` → 201; `GET /v1/billing/usage`) → 200 with `records.length === 0` — tenant B sees zero of tenant A's usage records (scoped to the calling tenant only).
- Pagination shape present (response exposes `records` + `cursor`).

All 18/18 boundary assertions passed; `AC-012: ALL ASSERTIONS PASSED`.

Note: `agentBreakdown[].costUsd = 0` in this run because the `DeterministicAgentRunner` stub returns `costUsd: 0`; the wiring genuinely propagates each agent's computed `costUsd` from the runner into the persisted `UsageRecordEntity.agentBreakdown` (`investigate-incident.usecase.ts:1122-1127` → `bootstrap.ts:876-890` `RecordUsageUseCase` → `DynamoUsageRecordRepository`). With the real Anthropic runner the cost is non-zero. Non-critical Hindsight reflect/retain warnings logged (HINDSIGHT_API_URL empty) — best-effort, do not block the investigation or the usage record write, consistent with the spec's failure-behaviour for memory.

Doc-drift note (unchanged from WI-AC-007/AC-011): literal `/api/v1/billing/usage` is not mounted (no global `/api` prefix; route is `/v1/billing/usage`). Per the contradictions clause (implementation authoritative), the functional AC-012 behaviour is fully met.

## 2026-07-08T04:25:00.000Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-012
- AcceptanceChecks: AC-012
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T05:07:24.749Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-012
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T05:23:11.845Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-012
- Outcome: integration could not complete
- Defects: error: Your local changes to the following files would be overwritten by merge:
	core/.env.example
	core/.env.localstack
	core/.gitignore
	core/INVARIANTS.md
	core/docker-compose.yml
	core/infra/localstack/init/01-create-resources.sh
	core/infra/scripts/check-invariants.ts
	core/packages/widget/vite.config.ts
	core/src/app.ts
	core/src/bootstrap.ts
	core/src/modules/audit/infra/audit.routes.ts
	core/src/modules/audit/infra/dynamo-audit.repository.ts
	core/src/modules/auth/infra/auth.routes.ts
	core/src/modules/billing/application/handle-webhook.usecase.ts
	core/src/modules/billing/infra/stripe-client.ts
	core/src/modules/billing/infra/stripe-plan-catalog.service.ts
	core/src/shared/config/index.ts
	core/src/shared/domain/types.ts
	core/src/shared/infra/health/checks/anthropic-check.ts
	core/src/shared/infra/http/middleware/auth.middleware.ts
	core/src/shared/infra/http/middleware/tenant.middleware.ts
	core/tests/src/app.test.ts
	core/tests/unit/modules/audit/dynamo-audit.repository.test.ts
	public-docs/.gitignore
	public-docs/.mintignore
	public-docs/README.md
	public-docs/docs.json
	public-docs/snippets/auth-header.mdx
	public-docs/snippets/rate-limit-note.mdx
	relay/.gitignore
	relay/package-lock.json
	relay/src/config/schema.ts
	relay/src/drivers/postgres/pg-query-parser.ts
	relay/src/index.ts
	web/apps/dashboard/package.json
	web/apps/dashboard/src/app/[locale]/accept-invitation/page.tsx
	web/apps/dashboard/src/app/[locale]/auth/sign-in/[[...sign-in]]/page.tsx
	web/apps/dashboard/src/app/[locale]/auth/sign-up/[[...sign-up]]/page.tsx
	web/apps/dashboard/src/app/[locale]/beta-waitlist/page.tsx
	web/apps/dashboard/src/app/[locale]/create-organization/[[...create-organization]]/page.tsx
	web/apps/dashboard/src/app/[locale]/dashboard/analyses/[id]/page.tsx
	web/apps/dashboard/src/app/[locale]/dashboard/analyses/new/page.tsx
	web/apps/dashboard/src/app/[locale]/dashboard/analyses/page.tsx
	web/apps/dashboard/src/app/[locale]/dashboard/intelligence/page.tsx
	web/apps/dashboard/src/app/[locale]/dashboard/relay/page.tsx
	web/apps/dashboard/src/app/[locale]/dashboard/settings/page.tsx
	web/apps/dashboard/src/app/[locale]/dashboard/team/page.tsx
	web/apps/dashboard/src/app/[locale]/onboarding/business-profile/page.tsx
	web/apps/dashboard/src/app/[locale]/page.tsx
	web/apps/dashboard/src/app/[locale]/waitlist/[[...waitlist]]/page.tsx
	web/apps/dashboard/src/app/api/investigation/[id]/chat/route.ts
	web/apps/dashboard/src/app/api/investigation/[id]/detail/route.ts
	web/apps/dashboard/src/app/api/investigation/[id]/relay-token/route.ts
	web/apps/dashboard/src/app/api/investigation/[id]/tool-calls/[toolCallId]/route.ts
	web/apps/dashboard/src/contexts/identity/api/complete-profile-handler.test.ts
	web/apps/dashboard/src/contexts/identity/api/complete-profile-handler.ts
	web/apps/dashboard/src/contexts/identity/presentation/pages/beta-waitlist-page.tsx
	web/apps/dashboard/src/contexts/settings/presentation/pages/settings-page.tsx
	web/apps/dashboard/src/contexts/team/presentation/pages/team-page.tsx
	web/apps/website/src/contexts/marketing/infrastructure/i18n/en.json
	web/apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json
	web/apps/website/src/contexts/marketing/presentation/pages/home-page.tsx
	web/pnpm-lock.yaml
	web/vitest.config.ts
Please commit your changes or stash them before you merge.
error: The following untracked working tree files would be overwritten by merge:
	.harness/bootstrap.host
	.harness/bootstrap.log
	.harness/bootstrap.pid
	.harness/conclude-merge.log
	.harness/journal-conflict-resolve.log
	.harness/projects.json
	.pi/settings.json
	.turbo/cache/040f6817376e2598-meta.json
	.turbo/cache/040f6817376e2598.tar.zst
	.turbo/cache/0aaf10ddfb42531f-meta.json
	.turbo/cache/0aaf10ddfb42531f.tar.zst
	.turbo/cache/599716d50635a10a-meta.json
	.turbo/cache/599716d50635a10a.tar.zst
	.turbo/cache/a24a607d82d1451c-meta.json
	.turbo/cache/a24a607d82d1451c.tar.zst
	.turbo/cache/a613f0db8d08696b-meta.json
	.turbo/cache/a613f0db8d08696b.tar.zst
	.turbo/cache/afd2111fb699d535-meta.json
	.turbo/cache/afd2111fb699d535.tar.zst
	.turbo/cache/c34fb7eaabe6966e-meta.json
	.turbo/cache/c34fb7eaabe6966e.tar.zst
	.turbo/cache/dfb2fce1822ff665-meta.json
	.turbo/cache/dfb2fce1822ff665.tar.zst
	core/.harness-technology-inventory.json
	core/.harness/bootstrap.host
	core/.harness/planner-feature.pid
	core/ac011-boundary.mjs
	core/harness-progress/billing.md
	core/harness-progress/foundation.md
	core/harness-progress/open-source-local-runtime.md
	core/init.sh
	core/project_specs.xml
	core/src/modules/audit/application/delete-audit-entry.usecase.ts
	core/tests/unit/modules/audit/delete-audit-entry.test.ts
	public-docs/.dockerignore
	public-docs/.harness-technology-inventory.json
	public-docs/Dockerfile
	public-docs/docker-compose.yml
	public-docs/feature_list.json
	public-docs/harness-progress/WI-AC-006-integration.md
	public-docs/harness-progress/content-structure.md
	public-docs/harness-progress/foundation.md
	public-docs/harness-progress/open-source-local-runtime.md
	public-docs/init.sh
	public-docs/project_specs.xml
	relay/.env.example
	relay/.harness-technology-inventory.json
	relay/.harness/bootstrap.host
	relay/.harness/bootstrap.log
	relay/.harness/bootstrap.pid
	relay/.harness/plan.done
	relay/.harness/plan.host
	relay/.harness/plan.log
	relay/.harness/plan.pid
	relay/docker-compose.yml
	relay/feature_list.json
	relay/harness-progress/foundation.md
	relay/harness-progress/open-source-local-runtime.md
	relay/harness-progress/transport.md
	relay/init.sh
	relay/project_specs.xml
	relay/relay-config.docker.yaml
	relay/scripts/control-plane-stub/Dockerfile
	relay/scripts/control-plane-stub/initdb/01-orders.sql
	relay/scripts/control-plane-stub/package.json
	relay/scripts/control-plane-stub/server.mjs
	web/.harness-technology-inventory.json
	web/.harness/bootstrap.host
	web/.harness/bootstrap.pid
	web/.harness/plan.done
	web/.harness/plan.host
	web/.harness/plan.pid
	web/apps/dashboard/src/contexts/identity/presentation/components/accept-invitation-client.tsx
	web/apps/dashboard/src/contexts/identity/presentation/pages/accept-invitation-page.tsx
	web/apps/dashboard/src/contexts/identity/presentation/pages/create-organization-page.tsx
	web/apps/dashboard/src/contexts/identity/presentation/pages/sign-in-page.tsx
	web/apps/dashboard/src/contexts/identity/presentation/pages/sign-up-page.tsx
	web/apps/dashboard/src/contexts/identity/presentation/pages/waitlist-page.tsx
	web/apps/dashboard/src/contexts/integrations/presentation/pages/relay-page.tsx
	web/apps/dashboard/src/contexts/investigation/api/investigation-chat-handler.ts
	web/apps/dashboard/src/contexts/investigation/api/investigation-detail-handler.ts
	web/apps/dashboard/src/contexts/investigation/api/investigation-relay-token-handler.ts
	web/apps/dashboard/src/contexts/investigation/api/investigation-tool-calls-handler.ts
	web/apps/dashboard/src/contexts/investigation/presentation/pages/analyses-page.tsx
	web/apps/dashboard/src/contexts/investigation/presentation/pages/analysis-detail-page.tsx
	web/apps/dashboard/src/contexts/investigation/presentation/pages/new-analysis-page.tsx
	web/apps/dashboard/src/contexts/onboarding/presentation/pages/business-profile-route-page.tsx
	web/apps/dashboard/src/contexts/shared/presentation/pages/intelligence-route-page.tsx
	web/apps/dashboard/src/contexts/shared/presentation/pages/root-page.tsx
	web/feature_list.json
	web/harness-prog
Aborting
Merge with strategy ort failed.
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T10:51:20.383Z — Explicit Resume

- WorkItem: WI-AC-012
- Outcome: user authorized a new Attempt cycle
- Guidance: Retrying after two now-fixed root causes: a shared rate-limit exhaustion hit all 4 concurrent subprojects earlier, and main briefly had corrupted history from an unrelated incident, now recovered with scaffolding restored. Retry for a fresh attempt.
- NextAction: Coding Attempt 1

## 2026-07-08T10:52:00.000Z — Verify-first retry (WI-AC-012)

**Result: implementation=true**

Re-ran the AC-012 boundary after the orchestrator's now-fixed root causes (shared rate-limit exhaustion + recovered main history). Main is clean at `70ad848` (qa(harness): integrate WI-AC-009); the AC-012 implementation commit `057c3f0` (fix(billing): record UsageRecord on investigation completion) is intact on `gen/core-billing` and the working tree is clean (zero-diff checkpoint — no code changes).

Stack already up from foundation: `core-ministack-1` :4566 (healthy), `core-redis-1` (172.18.0.4:6379, healthy). Reused the gitignored local setup (`.env.ac012`, RSA keypair at `/tmp/ac011-clerk-{priv,pub}.pem`). PORT=5181 free; `/health` → 200 `{dynamodb:ok,redis:ok,sqs:ok,anthropic:ok}`.

Boundary (`npx tsx --env-file=.env.ac012 ac012-boundary.ts`, real `fetch`es on PORT=5181, app bootstrapped with `DeterministicLLMClient` + `DeterministicAgentRunner` stubs so a real investigation runs end-to-end through the in-process pipeline fallback — no paid Anthropic calls; Clerk JWT verified networklessly via `CLERK_JWT_KEY`):

- `POST /v1/tenants` (admin JWT) → 201, `tenantId = org_ac012_<ts>` (= JWT `o.id`).
- `POST /v1/incident/chat` `{severity:"critical", suggestedAgents:[log_analyst,metric_analyst,infra_inspector]}` → 201, incident dispatched a real stub-backed investigation.
- Poll `GET /v1/incidents/:id` → reached terminal `status=awaiting_approval` within ~0.5s (investigation completed).
- `GET /v1/billing/usage` (tenant A) → 200, `records[0] = {type:"investigation", incidentId:<uuid>, costUsd:0, agentBreakdown:[{agentRole:"log_analyst",inputTokens:500,outputTokens:200,costUsd:0},{agentRole:"metric_analyst",...},{agentRole:"infra_inspector",...}]}` — confirms a **UsageRecordEntity** is written on investigation completion with the **investigation ID**, **per-agent token counts** and **per-agent cost**.
- Tenant scoping: tenant B (`POST /v1/tenants` → 201; `GET /v1/billing/usage`) → 200, `records.length === 0` — tenant B sees zero of tenant A's records (scoped to the calling tenant only; tenantId comes only from the verified JWT).
- Pagination shape present (`records` + `cursor`).

All 18/18 boundary assertions passed; `AC-012: ALL ASSERTIONS PASSED`. Non-critical Hindsight retain warnings logged (HINDSIGHT_API_URL empty) — best-effort, do not block the investigation or the usage record write, consistent with the spec's memory failure-behaviour.

Doc-drift note unchanged: literal `/api/v1/billing/usage` is not mounted (no global `/api` prefix; route is `/v1/billing/usage`). Per the contradictions clause (implementation authoritative) and WI-AC-007 precedent, the functional AC-012 behaviour is fully met.

- NextAction: Integrated Verification

## 2026-07-08T10:58:00.000Z — QA independent verification (WI-AC-012, fresh attempt)

**Result: qa=true, implementation=true**

Independently re-ran the AC-012 boundary against a freshly booted app (`npx tsx --env-file=.env.ac012 ac012-boundary.ts`, which bootstraps the app with `DeterministicLLMClient` + `DeterministicAgentRunner` stubs so a real investigation runs end-to-end through the in-process pipeline fallback — no paid Anthropic calls). PORT=5181, existing stack: core-ministack-1 :4566 (healthy), core-redis-1 (172.18.0.4:6379, healthy). `/health` → 200 `{dynamodb:ok,redis:ok,sqs:ok,anthropic:ok}`. Clerk JWT verified networklessly via `CLERK_JWT_KEY` (RS256 signed with /tmp/ac011-clerk-priv.pem).

Real HTTP exercised (real `fetch`es on PORT=5181, full in-process pipeline: incident.created → triage → investigation → investigation.completed → RecordUsageUseCase):

- `POST /v1/tenants` (admin JWT) → 201, `tenantId = org_ac012_<ts>` (= JWT `o.id`).
- Provisioned a `BillingAccountEntity` for tenant A (setup only).
- `POST /v1/incidents/chat` `{severity:"critical", suggestedAgents:[log_analyst,metric_analyst,infra_inspector]}` → 201, dispatched a real stub-backed investigation.
- Poll `GET /v1/incidents/:id` → reached terminal `status=awaiting_approval` within ~0.5s (investigation completed).
- `GET /v1/billing/usage` (tenant A) → 200, `records[0] = {type:"investigation", incidentId:<uuid>, costUsd:0, agentBreakdown:[{agentRole:"log_analyst",inputTokens:500,outputTokens:200,costUsd:0},{agentRole:"metric_analyst",...},{agentRole:"infra_inspector",...}]}` — confirms a **UsageRecordEntity** is written on investigation completion with the **investigation ID**, **per-agent token counts** and **per-agent cost**.
- Tenant scoping: tenant B (`POST /v1/tenants` → 201; `GET /v1/billing/usage`) → 200, `records.length === 0` — tenant B sees zero of tenant A's records (scoped to the calling tenant only; tenantId comes only from the verified JWT).
- Pagination shape present (`records` + `cursor`).

All 18/18 boundary assertions passed; `AC-012: ALL ASSERTIONS PASSED`. Non-critical Hindsight retain warnings logged (HINDSIGHT_API_URL empty) — best-effort, do not block the investigation or the usage record write, consistent with the spec's memory failure-behaviour.

Doc-drift note unchanged: literal `/api/v1/billing/usage` is not mounted (no global `/api` prefix; route is `/v1/billing/usage`). Per the contradictions clause (implementation authoritative) and WI-AC-007 precedent, the functional AC-012 behaviour is fully met.

- NextAction: Integrated Verification

## 2026-07-08T10:58:45.320Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-012
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T11:13:00.000Z — Integrated Verification (WI-AC-012)

**Result: integration=true, implementation=true, qa=true**

Re-ran the AC-012 boundary against latest main (HEAD=`5367ca5` merge(harness): resolve WI-AC-012; working tree clean). Reconstructed the gitignored local setup (`.env.ac012`, RSA keypair reused at `/tmp/ac011-clerk-{priv,pub}.pem`) from the journal. Booted the app via `npx tsx --env-file=.env.ac012 ac012-boundary.ts` (which bootstraps with `DeterministicLLMClient` + `DeterministicAgentRunner` stubs so a real investigation runs end-to-end through the in-process pipeline fallback — no paid Anthropic calls) on the assigned PORT=5181 against the existing stack (core-ministack-1 :4566 healthy, core-redis-1 172.18.0.4:6379 healthy). `/health` → 200 `{dynamodb:ok,redis:ok,sqs:ok,anthropic:ok}`.

Key setup detail (re-derived from journal): the `.env.ac012` must NOT set any `SQS_*_QUEUE_URL` vars, so `config.sqs.alertQueueUrl && investigationQueueUrl && remediationQueueUrl` is falsy and `bootstrap.ts` enables the **in-process pipeline fallback** (`[STARTUP] SQS not configured — enabling in-process pipeline fallback`). Setting the SQS URLs routes the investigation through the SQS consumer → `dispatchInvestigation` → ECS/Fargate, which fails on ministack (`UnrecognizedClientException` — ministack has no ECS). With SQS unset, `incident.created → triage → incident.status_changed(triaging) → dispatchInvestigation.execute` (the use case, in-process) runs the stub-backed investigation to `investigation.completed → RecordUsageUseCase`.

Real HTTP exercised (real `fetch`es on PORT=5181, Clerk JWT RS256 verified networklessly via `@clerk/backend` against `CLERK_JWT_KEY`):

- `POST /v1/tenants` (admin JWT) → **201**, `tenantId = org_ac012_<ts>` (= JWT `o.id`).
- Provisioned a `BillingAccountEntity` for tenant A (setup only, so `reserveInvestigation` succeeds).
- `POST /v1/incident/chat` `{severity:"critical", suggestedAgents:[log_analyst,metric_analyst,infra_inspector]}` → **201**, incident dispatched a real stub-backed investigation.
- Poll `GET /v1/incidents/:id` → reached terminal `status=awaiting_approval` within ~0.5s (investigation completed).
- `GET /v1/billing/usage` (tenant A) → **200**, `records[0] = {type:"investigation", incidentId:<uuid>, costUsd:0, agentBreakdown:[{agentRole:"log_analyst",inputTokens:500,outputTokens:200,costUsd:0},{agentRole:"metric_analyst",...},{agentRole:"infra_inspector",...}]}` — confirms a **UsageRecordEntity** is written on investigation completion with the **investigation ID**, **per-agent token counts** and **per-agent cost**.
- Tenant scoping: tenant B (`POST /v1/tenants` → 201; `GET /v1/billing/usage`) → **200**, `records.length === 0` — tenant B sees zero of tenant A's records (scoped to the calling tenant only; `tenantId` comes only from the verified JWT).
- Pagination shape present (`records` + `cursor`).

All 18/18 boundary assertions passed; `AC-012: ALL ASSERTIONS PASSED`. Non-critical Hindsight retain warnings logged (`HINDSIGHT_API_URL` empty) — best-effort, do not block the investigation or the usage record write, consistent with the spec's memory failure-behaviour.

Regression: `pnpm typecheck` clean; `pnpm lint-invariants` 10/10 pass (I1–I11); `pnpm test:run` 162 files / 1057 tests pass.

Doc-drift note unchanged (literal `/api/v1/billing/usage` not mounted — no global `/api` prefix; route is `/v1/billing/usage`). Per the contradictions clause (implementation authoritative) and WI-AC-007 precedent, the functional AC-012 behaviour is fully met.

## 2026-07-08T11:13:30.000Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-012
- AcceptanceChecks: AC-012
- Outcome: passed on integrated main
- Evidence: `ac012-boundary.ts` run log (PORT=5181)
- NextAction: next Ready Work Item

## 2026-07-08T11:14:20.784Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-012
- AcceptanceChecks: AC-012
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/billing/WI-AC-012-1-integration_qa.log
- NextAction: next Ready Work Item

## WI-AC-013 — Verify-first (billing)

**Result: implementation=true**

Boundary exercised against a real running app on the assigned PORT=5181 (real HTTP `fetch`es, no mocking of the verification path). The app was booted in-process via the `ac012-boundary.ts` pattern: `ac013-boundary.ts` calls `bootstrap({ llmClient: DeterministicLLMClient, agentRunner: DeterministicAgentRunner })` + `createApp(ctx)` + `serve(...)` on PORT (no paid Anthropic calls — AC-013 does not run an investigation; the stubs only satisfy the composition root). Stack already up from foundation: `core-ministack-1` :4566 (healthy), `core-redis-1` (172.18.0.4:6379, healthy), `stripe-mock` :12111. Local untracked `.env.ac013` (gitignored via `.env.ac0*`) is not used by the in-process run — env is injected in-script before `config`/`bootstrap` import: `DYNAMODB_ENDPOINT=http://localhost:4566`, `DYNAMODB_TABLE_NAME=causeflow-local`, `REDIS_URL=redis://172.18.0.4:6379`, `STRIPE_WEBHOOK_SECRET=whsec_ac013_boundary_secret`, `STRIPE_HOST=localhost`/`12111`/`http` (routes the Stripe SDK at stripe-mock), `CLERK_JWT_KEY=<2048-bit RSA SPKI PEM>` (networkless Clerk RS256 verification, reused from WI-AC-007/011 at `/tmp/ac011-clerk-{priv,pub}.pem`). `/health` → 200.

### Acceptance boundary (AC-013)

> Stripe webhook with an invalid signature (mutated body) returns 400; valid signature returns 200. After `customer.subscription.deleted` arrives, the tenant's plan drops to "free" and gated endpoints return 402.

Two real verification paths exercised (no mocking of `constructEvent` or `verifyToken`):

1. **Real Stripe webhook signature, genuinely verified.** A `customer.subscription.deleted` event was signed with the shared webhook secret using the Stripe SDK's `stripe.webhooks.generateTestHeaderString({ payload, secret })` — byte-identical `t=…,v1=…` HMAC-SHA256 to what the Stripe CLI emits. The app's `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)` performs the genuine HMAC verification (recomputes the signature, enforces timestamp tolerance). Invalid-signature case: the body was mutated *after* signing (event type string flipped) so the HMAC no longer matches the payload → `constructEvent` throws → `ValidationError` → 400.

2. **Valid Clerk session JWT, networklessly verified.** RS256-signed with the local 2048-bit RSA key; `@clerk/backend` `verifyToken({ jwtKey })` verifies the signature networklessly (the real Clerk verification path — no JWKS call). Used to create the tenant (`POST /v1/tenants`, admin role) so `tenantId` = JWT `o.id` and is cryptographically bound to the caller.

Evidence (`npx tsx ac013-boundary.ts`, real `fetch`es on PORT=5181):

- `POST /v1/tenants` (admin JWT) → **201**, `tenantId = org_ac013_<ts>` (= JWT `o.id`, cryptographically verified).
- Setup: `BillingAccountEntity` provisioned at the starter plan (15 investigations / 500 events) directly via `DynamoBillingAccountRepository.create` (establishes the pre-deletion quota — proves the drop).
- `GET /v1/billing/subscription` (pre-delete) → **200**, `plan=starter`, `investigationsLimit=15`.
- `GET /v1/billing/usage` (pre-delete) → **200**, `account.investigationsLimit=15`.
- `POST /v1/billing/webhook` with **mutated body** (event type string flipped after signing → HMAC mismatch) → **400** — confirms `constructEvent` genuinely verifies signatures, not passing them through.
- `POST /v1/billing/webhook` (`customer.subscription.deleted`, valid HMAC sig) → **200** `{received:true}` — signature verified.
- `GET /v1/billing/subscription` (post-delete) → **200**, `plan="free"`, `status="canceled"`, `investigationsLimit=0` — tenant plan dropped to free.
- `GET /v1/billing/usage` (post-delete) → **200**, `account.investigationsLimit=0`, `eventsLimit=0` — BillingAccount quotas dropped to the free plan.
- `POST /v1/incidents/chat` (gated endpoint, admin JWT) → **402** `{error:"QUOTA_EXCEEDED"}` — gated endpoint returns 402 after the plan drops to free (the `reserveInvestigation` atomic counter check `used < limit` fails with `limit=0`).

All 15 boundary assertions passed (15/15); `AC-013: ALL ASSERTIONS PASSED`.

### Path note (doc drift, out of scope)

The spec AC text says `POST /api/v1/billing/webhook`. The implementation mounts all module routes at `/v1/*` with **no `/api` prefix** (global doc drift, same as WI-AC-007/011/012). Per the contradictions clause ("implementation is authoritative") and the WI-AC-007 precedent, the real boundary exercised is `POST /v1/billing/webhook`; the literal `/api/v1/billing/webhook` returns 404. The functional AC-013 behaviour (invalid signature → 400; valid signature → 200; subscription.deleted → plan drops to free; gated endpoints → 402) is fully met.

### Root-cause fixes (smallest diff, 4 files)

The existing code failed AC-013 at the boundary; the root cause fixed with no refactor:

1. **`customer.subscription.deleted` never dropped the plan to "free"** — `handleSubscriptionDeleted` only set `subscriptionStatus='canceled'` and cleared `stripeSubscriptionId`; it left `plan` at the prior tier (`starter`) and never reset the `BillingAccount` quotas, so gated endpoints kept returning 200. Added `plan: 'free'` to the tenant update and a `syncBillingAccount(tid, 'free')` call so the `BillingAccount` quotas drop to 0/0 (free plan). The gated endpoint (`POST /v1/incidents/chat` → `reserveInvestigation`) then fails the `used < limit` check with `limit=0` and returns 402.
2. **`'free'` was not a valid `TenantPlan`** — added `'free'` to the `TenantPlan` union and to the `TenantEntity` ElectroDB `plan` enum (so `tenantRepo.update({ plan: 'free' })` is accepted). `free` is NOT added to any client-facing zod enum (signup/checkout/tenant-create still only offer `starter|pro|business|enterprise`), so it is only ever set by the subscription-deleted webhook.
3. **`PLAN_CREDITS`/`PLAN_QUOTAS` (fallback catalog) had no `free` entry** — `Record<TenantPlan, …>` requires all union members, so added `free: { investigations: 0, events: 0, priceUsd: 0 }` (and `PLAN_CREDITS.free = 0`). This also makes the fallback catalog include a free plan for the subscription info path.
4. **`syncBillingAccount` depended on the catalog for the free plan** — production Stripe accounts typically have no "free" Price, so `getPlanByKey('free')` would return `null` and the quota drop would be skipped. Added a `plan === 'free'` special-case in `syncBillingAccount` that uses quotas `0/0` directly (bypassing the catalog), so the drop-to-free behaviour does not depend on a free Price existing in Stripe. Paid plans resolve via the catalog unchanged.

No refactor/restructure of working code. The read path (`GetSubscriptionUseCase` / `GET /v1/billing/usage`) was already correct (it reads `tenant.plan` and `BillingAccount` quotas) — no change. The invalid-signature → 400 path (ValidationError → errorHandler) was already correct — no change. Local untracked setup (gitignored): `.env.ac013`; tracked verification artefact: `ac013-boundary.ts` (matches the WI-AC-011/012 precedent of committing the boundary script). Generated RSA keypair reused at `/tmp/ac011-clerk-{priv,pub}.pem`.

### Regression checks

- `pnpm typecheck` → clean.
- `pnpm lint-invariants` → 10 passed, 0 failed (I1–I11).
- `pnpm test:run` → 162 files / 1057 tests pass.

## 2026-07-08T11:36:00.000Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-013
- AcceptanceChecks: AC-013
- Outcome: implementation=true (boundary passed at real HTTP on PORT=5181)
- NextAction: Integrated Verification

## 2026-07-08 — QA independent verification (WI-AC-013)

**Result: qa=true, implementation=true**

Independently verified AC-013 against a freshly booted in-process app on PORT=5182 (existing stack: core-ministack-1 :4566 healthy, core-redis-1 172.18.0.4:6379 healthy, stripe-mock :12111). Wrote a separate independent verification script (`qa-ac013-independent.ts`, NOT reusing `ac013-boundary.ts` logic) that:

1. Computes the Stripe v1 webhook signature **manually with `node:crypto` HMAC-SHA256** (the `t=<ts>,v1=<hex>` format) — NOT via `stripe.webhooks.generateTestHeaderString` — and verifies it byte-for-byte against the expected format.
2. Uses a **WRONG-SECRET** negative (signature computed with a different secret than the app's `STRIPE_WEBHOOK_SECRET`) plus a **missing-signature-header** negative — independent from the boundary's mutated-body negative — to exercise the 400 path.

Real HTTP exercised (real `fetch`es on PORT=5182, Clerk RS256 JWT verified networklessly via `CLERK_JWT_KEY`):

- `POST /v1/tenants` (admin JWT) → 201, `tenantId = org_qa013_<ts>` (= JWT `o.id`).
- Pre-delete: `GET /v1/billing/subscription` → plan=`starter`, `investigationsLimit=15`.
- `POST /v1/billing/webhook` (signature computed with WRONG secret) → **400** — `constructEvent` HMAC mismatch rejected.
- `POST /v1/billing/webhook` (missing `stripe-signature` header) → **400** — `ValidationError('Missing stripe-signature header')`.
- `POST /v1/billing/webhook` (`customer.subscription.deleted`, signature computed with REAL secret via manual crypto) → **200** `{received:true}` — signature genuinely verified.
- Post-delete: `GET /v1/billing/subscription` → plan=`free`, `investigationsLimit=0`, `eventsLimit=0` — tenant plan dropped to free.
- `POST /v1/incidents/chat` (gated endpoint) → **402** `{error:"QUOTA_EXCEEDED"}` — gated endpoint returns 402 after the plan drops to free (`reserveInvestigation` `used < limit` check fails with `limit=0`).
- Idempotent re-delivery of the same `customer.subscription.deleted` event → **200** (no regression, plan stays `free`).

All 9/9 independent assertions passed. Also re-ran the committed `ac013-boundary.ts` (PORT=5181) → 15/15 passed.

Regression: `pnpm typecheck` clean; `pnpm lint-invariants` 10/10 pass (I1–I11).

Doc-drift note unchanged (literal `/api/v1/billing/webhook` not mounted — no global `/api` prefix; route is `/v1/billing/webhook`). Per the contradictions clause (implementation authoritative) and WI-AC-007 precedent, the functional AC-013 behaviour is fully met.

## 2026-07-08T12:10:00.000Z — Integrated Verification (WI-AC-013)

**Result: integration=true, implementation=true, qa=true**

Re-ran the AC-013 boundary against latest main (HEAD=`c59fc20` Merge branch 'gen/core-billing'; worktree clean). Reused the tracked `ac013-boundary.ts` (in-process app boot with deterministic LLM/agent stubs — no paid Anthropic calls; AC-013 does not run an investigation) on the assigned PORT=5181 against the existing stack (core-ministack-1 :4566 healthy, core-redis-1 172.18.0.4:6379 healthy, stripe-mock :12111). RSA keypair reused at `/tmp/ac011-clerk-{priv,pub}.pem`; env injected in-script before `config`/`bootstrap` import. `/health` → 200.

Real HTTP exercised (real `fetch`es on PORT=5181, Clerk RS256 JWT verified networklessly via `@clerk/backend` against `CLERK_JWT_KEY`, Stripe webhook HMAC genuinely verified by `stripe.webhooks.constructEvent`):

- `POST /v1/tenants` (admin JWT) → **201**, `tenantId = org_ac013_<ts>` (= JWT `o.id`, cryptographically verified).
- Setup: `BillingAccountEntity` provisioned at starter (15 inv / 500 events) via `DynamoBillingAccountRepository.create`.
- Pre-delete: `GET /v1/billing/subscription` → **200** `plan=starter, investigationsLimit=15`; `GET /v1/billing/usage` → **200** `account.investigationsLimit=15`.
- `POST /v1/billing/webhook` with **mutated body** (event type string flipped after signing → HMAC mismatch) → **400** — `constructEvent` genuinely verifies signatures, not passing them through.
- `POST /v1/billing/webhook` (`customer.subscription.deleted`, valid HMAC sig) → **200** `{received:true}` — signature verified.
- Post-delete: `GET /v1/billing/subscription` → **200** `plan="free", status="canceled", investigationsLimit=0, eventsLimit=0` — tenant plan dropped to free.
- `GET /v1/billing/usage` (post-delete) → **200** `account.investigationsLimit=0, eventsLimit=0` — BillingAccount quotas dropped to the free plan.
- `POST /v1/incidents/chat` (gated endpoint, admin JWT) → **402** `{error:"QUOTA_EXCEEDED", message:"Investigation limit reached"}` — gated endpoint returns 402 after the plan drops to free (`reserveInvestigation` `used < limit` check fails with `limit=0`).

All 15/15 boundary assertions passed; `AC-013: ALL ASSERTIONS PASSED`.

Regression: `pnpm typecheck` clean; `pnpm lint-invariants` 10/10 pass (I1–I11); `pnpm test:run` 162 files / 1057 tests pass.

Doc-drift note unchanged (literal `/api/v1/billing/webhook` not mounted — no global `/api` prefix; route is `/v1/billing/webhook`). Per the contradictions clause (implementation authoritative) and WI-AC-007 precedent, the functional AC-013 behaviour is fully met.

## 2026-07-08T12:11:00.000Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-013
- AcceptanceChecks: AC-013
- Outcome: passed on integrated main
- Evidence: `ac013-boundary.ts` run log (PORT=5181), 15/15 assertions passed
- NextAction: next Ready Work Item

## 2026-07-08T11:45:43.282Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-013
- Outcome: isolated QA passed
- NextAction: Integrated Verification


## 2026-07-08T12:11:16.827Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-013
- AcceptanceChecks: AC-013
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/billing/WI-AC-013-1-integration_qa.log
- NextAction: next Ready Work Item

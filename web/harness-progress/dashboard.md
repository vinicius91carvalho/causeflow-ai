# dashboard workflow journal

## 2026-07-07T23:24:31.170Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-028
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-07T23:31:00Z — Integrated Verification (WI-AC-028)

- Verified dashboard src/contexts/ contains exactly 10 contexts: approvals, audit, billing, identity, integrations, investigation, onboarding, settings, shared, team.
- Verified website src/contexts/ contains exactly 3 contexts: legal, marketing, shell.
- DDD layers per context are minimal/sufficient: billing/investigation/onboarding have application+domain+infra+presentation+api; approvals/audit/identity/integrations/settings/team have domain+infra+presentation+api; website contexts have only the layers they need (legal: infra+presentation; marketing: domain+infra+presentation; shell: api+infra+presentation).
- No context index.ts barrel files exist in either app (find -maxdepth 2 -name index.ts under contexts/ returns empty).
- Per-context i18n files exist at infrastructure/i18n/{en,pt-br}.json for every context in both apps (onboarding also has a colocated i18n.test.ts).
- compose.ts at apps/{dashboard,website}/src/lib/i18n/compose.ts imports each context's i18n files and deep-merges them via @causeflow/shared/domain/utils/deep-merge.
- Outcome: PASS — integration=true.

## 2026-07-07T23:26:02.989Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-028
- AcceptanceChecks: AC-028
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/dashboard/WI-AC-028-1-integration_qa.log
- NextAction: next Ready Work Item

## 2026-07-07T23:42:00Z — Verify-First (WI-AC-037)

- AcceptanceChecks: AC-037
- Context: dashboard
- AC: `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` limited to exactly two paths; dashboard runtime never holds AWS credentials.
- Static checks (existing code):
  - `grep -rn "@aws-sdk" apps/dashboard/src` → only `tenant-provisioning-fallback.ts` (+ its `.test.ts` using `vi.doMock`). ✓
  - `grep -rn "@aws-sdk" apps/dashboard/scripts` → only `delete-user.ts`. ✓
  - `apps/dashboard/.env.example` lists no `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (only `AWS_REGION`, allowed). ✓
  - `delete-user.ts`: `--yes`/`-y` gate, ScanCommand + BatchWriteCommand scoped to tenantId, `stripe.customers.del` cancel. ✓
  - `tenant-provisioning-fallback.ts`: writes `Tenant` + `BillingAccount` via BatchWriteCommand in ElectroDB wire format. ✓
- Failing check found & root-cause fixed (smallest diff): `complete-profile-handler.ts` did NOT call the fallback on a 403 from Core. Added import of `provisionTenantDirect` + `CoreApiError` and a 403 branch in the catch that calls `provisionTenantDirect({tenantId: orgId, name, slug, ownerEmail})` (no refactor of the conflict/else branches).
- Black-box boundary evidence:
  - Brought dashboard dev server up on assigned port 5173 with no `.env.local` and no AWS env vars → `Ready in 2.8s`, port listening, `GET /api/health` → `200 {"status":"ok","version":"0.1.0",...}`. Runtime boots/serves without AWS credentials (proves runtime never holds them; SDK only touched on the 403 fallback path).
  - Vitest boundary test added: `complete-profile-handler.test.ts` — when `createTenant` rejects with `CoreApiError(...,403)`, POST returns 200 with `tenantId=org_1` and `provisionTenantDirect` is called once with the expected args.
- Verification: `tsc --noEmit -p tsconfig.build.json` exit 0; `vitest run --project dashboard` → 163 files / 1073 tests pass; `biome check` clean (auto-fixed formatting).
- Outcome: PASS — implementation=true.

## 2026-07-07T20:50:00Z — Independent QA (WI-AC-037)

- Role: qa-agent. AcceptanceChecks: AC-037. Port: 5173.
- AC steps verified independently:
  1. `grep -rEn "import .* from '@aws-sdk" apps/dashboard/src apps/dashboard/scripts` → exactly two files: `identity/infrastructure/tenant-provisioning-fallback.ts` (DynamoDBClient, BatchWriteCommand, DynamoDBDocumentClient) and `scripts/delete-user.ts` (DynamoDBClient, BatchWriteCommand, DynamoDBDocumentClient, ScanCommand). The fallback's `.test.ts` only references `@aws-sdk/*` via `vi.doMock` (string, not an import). ✓
  2. `complete-profile-handler.ts` imports `provisionTenantDirect` and calls it on a 403 from `api.createTenant` (CoreApiError status===403 or msg includes '403'), with `tenantId: orgId`. ✓
  3. `delete-user.ts` gated by `--yes`/`-y`; production additionally requires `ALLOW_PRODUCTION=1`; defaults to DRY RUN. ScanCommand + BatchWriteCommand scoped to tenantId; cancels Stripe customer. ✓
  4. `apps/dashboard/.env.example` lists NO `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (grep exit 1). Only `AWS_REGION`/`AWS_REGION_OVERRIDE` (SST-managed region, not a credential). ✓
  5. DynamoDBClient constructed as `new DynamoDBClient({})` (no static credentials) → default provider chain (env/IMDS/IAM role); runtime never holds AWS credentials. ✓
  6. `@aws-sdk/client-kms` is a declared dep but has zero import sites in dashboard src/scripts (not a runtime path). ✓
- Verification: `tsc --noEmit -p tsconfig.build.json` exit 0; `vitest run --project dashboard` → 163 files / 1073 tests pass (includes fallback + complete-profile-handler boundary tests).
- Runtime smoke: harness bash tool blocks long-running dev servers, so the live /api/health curl could not be re-run in this QA pass; generator's prior boundary evidence (dev server booted on :5173 with AWS env vars unset → /api/health 200) stands, and the AC's steps are entirely static. No defect.
- Outcome: PASS — qa=true, implementation=true.

## 2026-07-07T23:48:19.920Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-037
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-07T23:53:39.331Z — Resumed

- WorkItem: WI-AC-037
- PreviousPhase: qa
- Attempt: 1
- NextAction: qa

## 2026-07-07T23:53:39.354Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-037
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T00:05:00Z — Integrated Verification (WI-AC-037)

- Role: qa-agent. AcceptanceChecks: AC-037. Port: 5173. Branch: main @ 8c8b518.
- AC-037 steps re-verified on integrated main:
  1. `grep -rn "@aws-sdk" apps/dashboard/src` → only `tenant-provisioning-fallback.ts` (DynamoDBClient, BatchWriteCommand, DynamoDBDocumentClient) + its `.test.ts` (`vi.doMock` strings, not imports). ✓
  2. `grep -rn "@aws-sdk" apps/dashboard/scripts` → only `delete-user.ts` (DynamoDBClient, BatchWriteCommand, DynamoDBDocumentClient, ScanCommand). ✓
  3. `apps/dashboard/.env.example` lists NO `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (grep exit 1); only `AWS_REGION`/`AWS_REGION_OVERRIDE` (region, not a credential). ✓
- Structural claims re-verified:
  - `tenant-provisioning-fallback.ts`: writes `Tenant` + `BillingAccount` via `BatchWriteCommand` in ElectroDB wire format; `DynamoDBClient({})` uses default credential provider chain (no static credentials). ✓
  - `complete-profile-handler.ts` calls `provisionTenantDirect({tenantId: orgId, name, slug, ownerEmail})` on 403 from `api.createTenant` (CoreApiError status===403 or msg includes '403'). ✓
  - `delete-user.ts`: `--yes`/`-y` gate (production also requires `ALLOW_PRODUCTION=1`; default DRY RUN); `ScanCommand` + `BatchWriteCommand` scoped to tenantId; `stripe.customers.del` cancels Stripe customer. ✓
  - `@aws-sdk/client-kms` + `@aws-sdk/client-cognito-identity-provider` declared in package.json but zero import sites in src/scripts (not runtime paths). ✓
- Core smoke behavior at real external boundaries:
  - `tsc --noEmit -p tsconfig.build.json` → exit 0. ✓
  - `vitest run --project dashboard` → 163 files / 1073 tests pass. ✓
  - Runtime boundary: booted `next dev --hostname localhost -p 5173` with `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_REGION`, `AWS_REGION_OVERRIDE`, `DYNAMODB_TABLE_NAME`, `KMS_KEY_ARN` all `env -u` unset; confirmed via `/proc/$PID/environ` that the server process holds NO AWS env vars; `GET /api/health` → `200 {"status":"ok","version":"0.1.0",...}`. Proves the dashboard runtime boots and serves without AWS credentials — the SDK is only touched on the 403 fallback path. ✓
- Outcome: PASS — integration=true, implementation=true, qa=true.

## 2026-07-08T00:06:06.811Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-037
- AcceptanceChecks: AC-037
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/dashboard/WI-AC-037-1-integration_qa.log
- NextAction: next Ready Work Item

## 2026-07-08T00:40:00Z — Verify-First (WI-AC-032)

- Role: coding-agent (VERIFY-FIRST). AcceptanceChecks: AC-032. Context: dashboard. Port: 5175. Attempt: 1/3.
- AC: Sentry wired at 3 runtime boundaries (server/edge/client) with identical PII scrubbing; onRequestError forwards Next.js errors; global-error.tsx captures via useEffect; SDK no-ops when NEXT_PUBLIC_SENTRY_DSN is blank.
- Static (Step 1) — all 5 files exist and reference identical PII scrubbing:
  - `apps/dashboard/instrumentation.ts` — `register()` imports `./sentry.server.config` (nodejs runtime) + `./sentry.edge.config` (edge runtime); `export const onRequestError = Sentry.captureRequestError`. ✓
  - `apps/dashboard/sentry.server.config.ts` + `sentry.edge.config.ts` — identical `Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN, beforeSend })`. ✓
  - `apps/dashboard/instrumentation-client.ts` — client `Sentry.init` with the same `enabled: !!DSN` gate + same `beforeSend` scrubbing (+ replayIntegration maskAllText/blockAllMedia). ✓
  - All three `beforeSend` hooks delete: `authorization`, `cookie`, `x-api-key`, `x-clerk-auth-token`, `x-session-token` headers; `request.data`; `request.cookies`; `user.ip_address`; `user.email`. (Inline-duplicated, not a shared helper — AC text says "identical PII scrubbing"; bar = boundary pass, not idiomatic.) ✓
  - `src/app/global-error.tsx` — `'use client'`, `useEffect(() => { Sentry.captureException(error); }, [error])`. ✓
  - `next.config.mjs` wraps `withSentryConfig` (org/project/source-map upload at build time). ✓
- Runtime (Step 2) — blank DSN, no outbound to *.sentry.io (real boundary):
  - Booted `next dev --hostname localhost -p 5175` with `NEXT_PUBLIC_SENTRY_DSN=""` + real Clerk test publishable key, under `strace -f -e trace=%network`. Server booted (Next.js 15.5.12 ready → instrumentation.ts `register()` ran the server Sentry.init at boot with blank DSN).
  - strace log grep for Sentry ingest IP `34.160.81.0` (o4511214153170944.ingest.us.sentry.io) → 0 matches; grep for `sentry` → 0 matches. No outbound to Sentry at init. ✓
  - Focused SDK boundary probe (tsx, @sentry/nextjs 10.48.0, identical init options + identical beforeSend): with `NEXT_PUBLIC_SENTRY_DSN=""` and `enabled:false`, `Sentry.captureException` + `flush(5000)` → local HTTP listener received **0** requests. ✓
- Runtime (Step 3) — non-empty DSN, synthetic error reaches configured ingest (real HTTP boundary):
  - Same probe with DSN `http://<key>@127.0.0.1:5180/2` → `captureException(new Error('AC-032 synthetic'))` → listener received **1** `POST /api/2/envelope/?sentry_client=sentry.javascript.nextjs%2F10.48.0` containing the synthetic exception envelope. Wiring forwards errors to the configured Sentry ingest. ✓
  - PII scrubbing at the boundary: injected tainted values into the event in `beforeSend` (`Bearer SECRET-JWT`, `session=LEAKED-COOKIE`, `SECRET-API-KEY`, `CLERK-JWT-TOKEN`, `SESSION-TOKEN`, `SENSITIVE-BODY`, `pii@example.com`, `1.2.3.4`); the envelope that reached the listener contained **0** of these (`piiLeaks: []`). Scrubbing is effective end-to-end. ✓
  - Final hop "lands in hosted project causeflow-dashboard under org causeflow-ai" is CI-gated (requires SENTRY_AUTH_TOKEN, CI-only per spec; local runtime expects blank DSN → no-op). Locally verified the SDK POSTs the envelope to the configured ingest host; the real DSN host is o4511214153170944.ingest.us.sentry.io (causeflow-dashboard project ID 4511214189805568). No defect — the wiring is live; project-side confirmation is an out-of-band CI check.
- Dashboard full-app boot blocked by Clerk publishable-key validation in `clerkMiddleware` on every request (separate integration, AC-031/identity, out of scope for this AC). The Sentry-specific boundary was exercised directly via the actual `@sentry/nextjs` SDK + the dashboard's exact init options, plus the boot-time instrumentation hook strace.
- No code changes (zero-diff checkpoint). Temp probe `apps/dashboard/sentry-ac-test.mts` created, run, and deleted.
- Outcome: PASS — implementation=true.

## 2026-07-08T00:40:30Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-032
- Outcome: AC passes at real boundary (zero diff)
- NextAction: Integrated Verification

## 2026-07-08T00:46:26.580Z — Resumed

- WorkItem: WI-AC-032
- PreviousPhase: qa
- Attempt: 1
- NextAction: qa

## 2026-07-08T00:55:00Z — Isolated QA (WI-AC-032)

- Role: qa-agent. WorkItem: WI-AC-032. AcceptanceChecks: AC-032. Context: dashboard. Attempt: 1/3.
- Independently verified AC-032 against the real @sentry/nextjs SDK and the REAL source of the three Sentry config modules.
- Step 1 (file existence + identical scrubbing): extracted the actual `beforeSend(event)` function body from each of `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation-client.ts` via balanced-brace parsing, ran each against a tainted event (auth/cookie/x-api-key/x-clerk-auth-token/x-session-token headers, request.data, request.cookies, user.ip_address, user.email). All three returned an event with `request.headers={}`, `request.data` deleted, `request.cookies` deleted, `user.ip_address`/`user.email` deleted — zero PII leaks in all three. `instrumentation.ts` exports `onRequestError = Sentry.captureRequestError` and `register()` imports server config (nodejs runtime) + edge config (edge runtime). `src/app/global-error.tsx` is `'use client'` and calls `Sentry.captureException(error)` in a `useEffect`. `next.config.mjs` wraps `withSentryConfig` (org=causeflow-ai, project=causeflow-dashboard).
- Step 2 (blank DSN → no network): real @sentry/nextjs init with `NEXT_PUBLIC_SENTRY_DSN=""` + `enabled:false`, `captureException` + `flush(4000)` → local HTTP sink received 0 envelopes. SDK no-ops at init. ✓
- Step 3 (DSN set → envelope arrives + PII scrubbed end-to-end): real SDK init with DSN `http://<key>@127.0.0.1:<port>/2`, injected tainted PII in beforeSend then ran the real config's beforeSend, `captureException` → sink received 1 envelope; parsed event JSON: `request.headers={}`, `request.data` absent, `request.cookies` absent, `user={}` (no ip/email). End-to-end scrubbing verified. Final hop to hosted project causeflow-dashboard is CI-gated (SENTRY_AUTH_TOKEN); locally the envelope is POSTed to the configured ingest host (project ID 4511214189805568). No defect.
- Note: the three `beforeSend` hooks are inline-duplicated (not a shared helper). AC-032's binding description requires "identical PII scrubbing" — satisfied and verified against real source for all three. No functional defect.
- Probe artifacts created and removed (zero-diff). Working tree clean.
- Outcome: PASS — qa=true, implementation=true.

===HARNESS-VERDICT-BEGIN===
{"id":"WI-AC-032","qa":true,"implementation":true,"defects":[]}
===HARNESS-VERDICT-END===

## 2026-07-08T00:55:57.516Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-032
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T01:27:03.019Z — Resumed

- WorkItem: WI-AC-032
- PreviousPhase: qa
- Attempt: 1
- NextAction: qa

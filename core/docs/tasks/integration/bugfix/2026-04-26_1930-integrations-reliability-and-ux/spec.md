# /integrations Reliability + UX Fixes: Product Requirements Document

## 1. What & Why

**Problem:** `/integrations` trigger creation is completely broken (POST /v1/triggers → 500), non-incident triggers clutter the catalog, duplicate triggers can be added, Slack integration card renders raw i18n key strings, "Fire Test Error" creates 10 direct incidents instead of sending 1 Sentry event, and SQS operational logs spam staging at info level.

**Desired Outcome:** Trigger creation succeeds end-to-end. Catalog shows only incident-supported slugs per provider. No duplicate triggers allowed. Slack card renders correctly in en + pt-br. Fire Test Error exercises the real Sentry→webhook pipeline via 1 captureException call. SQS polling noise suppressed below info threshold.

**Justification:** Core product feature (incident-detection pipeline) is non-functional in staging/production. Platform stability and testability require these fixes before continued feature work.

## 2. Correctness Contract

**Audience:** Engineering team verifying the Composio integration pipeline works. Product team testing Sentry incident detection.

**Failure Definition:** POST /v1/triggers still returns 500. Fire Test Error creates incidents directly. Duplicate triggers can still be added. Raw i18n keys still visible.

**Danger Definition:** SDK fix breaks existing connected Composio accounts. GSI migration causes data loss. Slug format change orphans existing trigger rows.

**Risk Tolerance:** Prefer loud 409 over silent idempotent — surfaces integration bugs early.

## 3. Context Loaded

- `core/src/shared/infra/integrations/composio-trigger-service.ts:144-178` — SDK upsert bug (`triggerInstances` undefined) + HTTP fallback v1/v3 slug mismatch
- `core/src/shared/infra/integrations/composio-client.ts:15` — `new Composio({ apiKey })` from `@composio/core@^0.6.8`; public surface: `client.triggers`, `client.connectedAccounts`, `client.tools`
- `core/src/modules/integration/application/create-trigger.usecase.ts:26-54` — no duplicate check before `triggerRepo.create()`
- `core/src/shared/infra/db/entities/TriggerEntity.ts:20-30` — primary GSI on `tenantId/triggerId` only; no slug uniqueness constraint
- `core/src/modules/integration/infra/trigger-event-mapper.ts:34-51` — active incident-mapping slugs: `PAGERDUTY_INCIDENT_TRIGGERED`, `SENTRY_NEW_ISSUE`, `GITHUB_COMMIT_EVENT`, `GITHUB_PULL_REQUEST_EVENT`
- `web/apps/dashboard/src/contexts/integrations/presentation/components/integration-catalog.ts:179-222` — `TRIGGER_CATALOG` includes unmapped slugs (`SLACK_RECEIVE_MESSAGE`, all JIRA/LINEAR/NOTION/etc.)
- `web/apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx:99` — `availableTriggers` not filtered against already-added triggers
- `web/apps/dashboard/src/contexts/integrations/infrastructure/i18n/en.json:232-244` — Slack namespace missing: `connectedLabel`, `disconnectButton`, `disconnectTitle`, `cancelButton`
- `web/apps/dashboard/src/contexts/settings/api/fire-test-errors-handler.ts:7-25` — forwards to `CORE_API_URL/v1/admin/fire-test-errors` which creates 10 incidents
- `core/src/shared/infra/queue/sqs-client.ts:33,39,52` — all 3 `instrumentedCall(...)` invocations default to `logSuccessLevel: 'info'`
- `core/src/shared/infra/observability/outbound.ts:30,45` — `logSuccessLevel` type union already includes `'trace'`

## 4. Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| POST /v1/triggers success rate | 0% (always 500) | 100% for Sentry/PagerDuty | Manual trigger creation on /integrations |
| Duplicate triggers per tenant/provider/slug | Unbounded | 0 (409 on duplicate) | POST same slug twice → 409 |
| Untranslated Slack UI keys | 4 missing | 0 missing | Render /integrations with Slack connected |
| Fire Test Error incidents created | 10 per click | 0 per click (Sentry event instead) | Check incidents table after click |
| SQS logs at info level per minute | ~2/min (polling) | 0/min | Staging log stream for 5 min |

## 5. User Stories

GIVEN a tenant has Sentry connected via Composio OAuth
WHEN they add "New issue detected" trigger on /integrations
THEN trigger is created (200), stored in DB, and appears in their connected triggers list

GIVEN a tenant has a "New issue detected" trigger for Sentry
WHEN they try to add the same trigger again
THEN they receive a 409 Conflict and the dropdown no longer shows already-added triggers

GIVEN a tenant views /integrations with Slack connected
WHEN the Slack card renders
THEN all button labels show translated text (not raw i18n key strings)

GIVEN a developer clicks "Fire Test Error" on /dashboard/settings
WHEN the button is clicked once
THEN exactly 1 Sentry event appears in the Sentry dashboard and 0 incidents are created directly

GIVEN LOG_LEVEL=info in staging
WHEN the SQS poller runs
THEN no sqs.receive/send/delete ok messages appear in the log stream

GIVEN the Composio v3 API returns a slug format different from v1 (e.g., `sentry.new_issue` vs `SENTRY_NEW_ISSUE`)
WHEN Sprint 1 probes `client.triggers.list({ toolkits: ['sentry'] })`
THEN Sprint 1 executor documents the confirmed format in Agent Notes and Sprint 2 updates dashboard catalog to match

GIVEN a non-admin user attempts POST /v1/triggers
WHEN the request reaches the route handler
THEN 403 Forbidden is returned and no trigger row is created

## 6. Acceptance Criteria

- [ ] POST /v1/triggers with `{ provider: "sentry", triggerSlug: "SENTRY_NEW_ISSUE" }` returns 200 with trigger row persisted
- [ ] POST /v1/triggers same slug twice for same tenant returns 409 with `TriggerAlreadyExistsError`
- [ ] Dashboard "Add Trigger" dropdown excludes already-added triggers for each provider
- [ ] Slack card `connectedLabel`, `disconnectButton`, `disconnectTitle`, `cancelButton` render correctly in en and pt-br
- [ ] "Fire Test Error" button click → 200 response `{ fired: 1, name: "<ErrorName>" }` + 1 Sentry event, 0 direct incidents
- [ ] `sqs.receive ok`, `sqs.send ok`, `sqs.delete ok` logs do NOT appear at level 30 (info) in staging; appear at level 10 (trace) with `LOG_LEVEL=trace`
- [ ] All existing integration tests pass (no regression on connected-account flow)

## 7. Non-Goals

- Wiring new webhook event mappers for Datadog, GitHub deploy/code-scan — mappers don't exist yet; those slugs stay absent from catalog until the mapper is implemented in a separate sprint
- Deleting legacy `core/src/modules/admin/.../fire-test-errors` Core endpoint — kept as deprecated to avoid breaking existing API consumers; removal is a follow-up cleanup with a deprecation window
- PostHog mapper/trigger — no Composio toolkit for PostHog exists; out of scope until toolkit is available
- SQS error-level log demotion — error logs are actionable signals, not noise; only `ok` success logs are demoted since they have zero operational value at info level
- Composio v3 slug normalization for providers beyond Sentry + PagerDuty + GitHub — defer to per-provider sprint when those mappers are activated
- Audit log table creation — audit logging of trigger mutations is deferred; `requireRole('admin')` enforcement is verified this sprint but a dedicated audit log table is a separate infrastructure task

## 8. Technical Constraints

- Stack: TypeScript, Node.js, `@composio/core@^0.6.8`, ElectroDB (DynamoDB), Pino logger, Next.js 14 (App Router), next-intl, `@sentry/nextjs`
- Architecture: core follows modular monolith with use-cases, repositories, DI container. Dashboard uses React Server/Client components + route handlers.
- Performance: GSI query for duplicate check must be O(1); no full-table scan.
- ElectroDB schema changes require additive-only migration (no breaking attribute renames). New `tenantProviderSlug` attribute is a derived composite key populated at write time — no backfill needed for existing triggers since the GSI is only used for new-write dedup checks; existing triggers are unaffected.
- Composio SDK concurrent upsert: if two requests arrive simultaneously with same slug, the GSI check + create is NOT atomic. Acceptable at current scale — worst case is a duplicate row; the use-case check catches it on the second write if the first has already committed.
- next-intl missing key fallback: renders the key path as a string. This is the current broken behavior we fix by adding the missing keys; no additional fallback infra needed.
- SQS log demotion: demoted logs won't appear in monitoring at info level. Confirm that SQS failure/DLQ events are still captured at error level (unchanged by this fix) before deploying.

## 9. Architecture Decisions

| Decision | Reversal Cost | Alternatives Considered | Rationale |
|----------|--------------|------------------------|-----------|
| Use `client.triggers.upsert` (SDK) not HTTP fallback | Low | Keep HTTP fallback with v3 slug | SDK is canonical; fallback was a workaround for a misidentified bug |
| GSI pk = `tenantId#provider#triggerSlug` | Med | Unique composite GSI + separate validation query | Combines uniqueness enforcement with O(1) lookup in single GSI |
| 409 Conflict on duplicate (not idempotent 200) | Low | Return existing trigger silently | Loud failure surfaces bugs; dashboard filter makes normal users never hit it |
| `Sentry.captureException` + 200 response (not unhandled throw) | Low | Throw 500, let Next.js error boundary capture | Cleaner UX; explicit captureException guarantees delivery regardless of error boundary setup |
| Demote SQS logs at callsite not in helper default | Low | Change `outbound.ts` default | Avoids collateral demotion of redis/dynamodb/anthropic/clerk logs |

## 10. Security Boundaries

- **Auth model:** POST /v1/triggers requires `requireRole('admin')` (existing `trigger.routes.ts:51`). Sprint 1 must verify this check is intact and add a test for 403 on non-admin. No change to the auth mechanism.
- **Trust boundaries:** `triggerSlug` is user-supplied. Whitelist check (catalog membership) in `create-trigger.usecase.ts` executes BEFORE the Composio SDK upsert call — this is the primary guard. GSI dedup check is a defensive second layer for the uniqueness invariant. If whitelist check somehow passes an unknown slug, the SDK call may fail at Composio's end.
- **Data sensitivity:** Composio `connectedAccountId` treated as opaque token; not logged. GSI pk is non-sensitive composite key (`tenantId#provider#slug`). `Sentry.captureException` in Sprint 3 must not include user PII in the synthetic error message — Error message is hardcoded; no user data included.
- **Tenant isolation:** GSI pk includes `tenantId` as prefix — cross-tenant query structurally impossible with this index.
- **Dashboard access:** `/integrations` page is protected by Clerk auth and should be restricted to admin role. Sprint 2 should verify the page component checks for admin role before rendering trigger management controls.

## 11. Data Model

**Access Patterns:**
1. On trigger creation: check if `(tenantId, provider, triggerSlug)` already exists — low latency, single-item lookup
2. On trigger list: fetch all triggers for a tenant — existing `primary` index handles this

**New GSI — `byTenantProviderSlug`:**
- pk: `tenantId#provider#triggerSlug` (string concatenation, `#` separator)
- sk: `triggerId` (allows multiple values in theory, but uniqueness check at use-case prevents >1)
- Purpose: O(1) existence check before create

**Entities:** `TriggerEntity` — adds new index attribute `tenantProviderSlug` (derived, not user input). No existing attribute renames.

## 12. Shared Contracts

- **`TriggerAlreadyExistsError`** — new domain error class in `core/src/modules/integration/domain/errors.ts` (or existing errors file). Shape: `{ code: 'TRIGGER_ALREADY_EXISTS', triggerSlug, tenantId }`. Consumed by use-case (throw) + route layer (map to 409).
- **Incident-supporting trigger slugs** — set: `SENTRY_NEW_ISSUE`, `PAGERDUTY_INCIDENT_TRIGGERED`, `GITHUB_COMMIT_EVENT`, `GITHUB_PULL_REQUEST_EVENT`. Defined by `trigger-event-mapper.ts` mapped cases. Sprint 2 catalog MUST mirror exactly this set (plus any additions made in Sprint 1).
- **Fire Test Error response type:** `{ fired: 1; name: string }` — consumed by dashboard handler + UI card.

## 13. Architecture Invariant Registry

| Concept | Owner | Format/Values | Verify Command |
|---------|-------|---------------|----------------|
| Trigger slug casing | `composio-trigger-service.ts` | Matches v3 slug format (verify in Sprint 1) | `grep -r "triggerSlug" core/src/shared/infra/db/entities/TriggerEntity.ts` |
| `TriggerAlreadyExistsError` error code | `core/src/modules/integration/domain/` | `TRIGGER_ALREADY_EXISTS` | `grep -r "TRIGGER_ALREADY_EXISTS" core/src/modules/integration/` |
| Dashboard catalog ↔ Core mapper alignment | `trigger-event-mapper.ts` | Catalog slugs ⊆ mapped cases | Manual cross-check at Sprint 2 completion |

## 14. Open Questions

- [x] Slug format in v3 API: confirmed need Sprint 1 executor to probe Composio SDK/v3 response and adjust slugs if needed before wiring UI catalog. If v3 uses `sentry.new_issue` form, both core catalog and dashboard TRIGGER_CATALOG update.

## 15. Uncertainty Policy

When uncertain about v3 slug format: probe by calling `client.triggers.list({ toolkits: ['sentry'] })` and log the result. Use what the API returns.
When Sprint 2 catalog alignment conflicts with trigger-event-mapper.ts: defer to trigger-event-mapper.ts as single source of truth — remove slug from catalog rather than add placeholder mapping.

## 16. Verification

- Deterministic: `pnpm --filter core test`, `pnpm --filter dashboard build`, `pnpm --filter core typecheck`
- Manual: POST /v1/triggers via curl → 200. Repeat → 409. Open /integrations, add Sentry trigger, confirm appears in connected list, confirm dropdown no longer shows it. Slack card renders translated text. Fire Test Error → 1 Sentry event, 0 direct incidents. Staging logs show no sqs.* at level 30.

## 17. Sprint Decomposition

Sprint specs written to: `sprints/`
Progress tracked in: `progress.json`

### Sprint Overview

| Sprint | Title | Depends On | Batch | Model | Parallel With |
|--------|-------|------------|-------|-------|---------------|
| 1 | Core trigger pipeline correctness | None | 1 | sonnet | — |
| 2 | Dashboard catalog + UX | Sprint 1 | 2 | sonnet | Sprint 3 |
| 3 | Fire Test Error refactor | None | 2 | sonnet | Sprint 2 |
| 4 | SQS log demotion | None | 1 | sonnet | Sprint 1 |

Note: Sprint 1 + Sprint 4 run in parallel (Batch 1, no file overlap). Sprint 2 depends on Sprint 1 (needs confirmed slug format). Sprint 3 runs in parallel with Sprint 2 (different repos, no shared files).

### Sprint 1: Core trigger pipeline correctness → `sprints/01-core-trigger-pipeline.md`

**Objective:** Fix Composio SDK call + add duplicate-prevention GSI and use-case check.
**Estimated effort:** M
**Dependencies:** None

### Sprint 2: Dashboard catalog + UX → `sprints/02-dashboard-catalog-ux.md`

**Objective:** Filter trigger catalog to incident-supported slugs, add dup filter in dropdown, fix Slack i18n.
**Estimated effort:** S
**Dependencies:** Sprint 1 (needs confirmed slug format from v3 response)

### Sprint 3: Fire Test Error refactor → `sprints/03-fire-test-error.md`

**Objective:** Replace core-API-forward with `Sentry.captureException` for exactly 1 random error variant.
**Estimated effort:** S
**Dependencies:** None (parallel with Sprint 2)

### Sprint 4: SQS log demotion → `sprints/04-sqs-log-demotion.md`

**Objective:** Pass `logSuccessLevel: 'trace'` to all 3 SQS `instrumentedCall` invocations.
**Estimated effort:** S
**Dependencies:** None (parallel with Sprint 1)

## 18. Execution Log

[Tracked in progress.json]

## 19. Learnings

[Compound step output — filled after completion]

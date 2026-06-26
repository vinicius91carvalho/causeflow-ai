# INVARIANTS — /integrations Reliability Fixes

Cross-cutting contracts between Core and Dashboard for the trigger pipeline.

## Trigger Slug Format

- **Owner:** `core/src/shared/infra/integrations/composio-trigger-service.ts`
- **Preconditions:** Caller provides a slug from `TRIGGER_CATALOG` — must be in the v3 Composio format (determined in Sprint 1 execution)
- **Postconditions:** `composio-trigger-service.ts` stores only slugs that Composio v3 API accepts. The format used in DB row = the format accepted by POST trigger upsert endpoint.
- **Invariants:** Dashboard `TRIGGER_CATALOG` slugs must be a subset of slugs present in `core TRIGGER_CATALOG`. No slug in the dashboard catalog may be absent from the core catalog.
- **Verify:** `grep -r "triggerSlug" core/src/shared/infra/integrations/composio-trigger-service.ts | head -5`
- **Fix:** If slugs diverge between core and dashboard, use the format confirmed by probing `client.triggers.list({ toolkits: ['sentry'] })` in Sprint 1.

## TriggerAlreadyExistsError

- **Owner:** `core/src/modules/integration/domain/trigger.errors.ts`
- **Preconditions:** Thrown only when `findByTenantProviderSlug` returns a non-null result before `triggerRepo.create()`
- **Postconditions:** Route layer maps this error to HTTP 409. No new trigger row created.
- **Invariants:** `error.code === 'TRIGGER_ALREADY_EXISTS'`. Response body contains `{ error: 'TRIGGER_ALREADY_EXISTS', message }`.
- **Verify:** `grep -r "TRIGGER_ALREADY_EXISTS" core/src/modules/integration/`
- **Fix:** Ensure `trigger.routes.ts` has a catch block for `TriggerAlreadyExistsError` mapping to 409.

## Incident-Supported Trigger Slugs

- **Owner:** `core/src/modules/integration/infra/trigger-event-mapper.ts`
- **Preconditions:** Dashboard `TRIGGER_CATALOG` must only contain slugs that produce non-`unknown` output from `TriggerEventMapper.map()`
- **Postconditions:** Every slug shown in `/integrations` dropdown will produce an incident or change_event when a Composio webhook fires
- **Invariants:** `TRIGGER_CATALOG[provider]` slugs ⊆ active switch cases in `trigger-event-mapper.ts:map()`. Dead mapper methods (`mapSlackAlert`, `mapJiraAlert`) do NOT count as active.
- **Verify:** `grep -A2 "case '" core/src/modules/integration/infra/trigger-event-mapper.ts | grep -v 'default'`
- **Fix:** If a slug is in dashboard catalog but not handled by mapper, remove it from `integration-catalog.ts TRIGGER_CATALOG`.

## Fire Test Error Response Contract

- **Owner:** `web/apps/dashboard/src/contexts/settings/api/fire-test-errors-handler.ts`
- **Preconditions:** Route called via POST `/api/admin/fire-test-errors`
- **Postconditions:** Returns HTTP 200 with body `{ fired: 1, name: string }` where `name` is one of the 10 ERROR_VARIANTS. One `Sentry.captureException` call made, zero DB writes.
- **Invariants:** `fired === 1`. No `incidentId` in response. No Core API call.
- **Verify:** `grep -n "captureException\|CORE_API" web/apps/dashboard/src/contexts/settings/api/fire-test-errors-handler.ts`
- **Fix:** Remove any `CORE_API_URL` forward; ensure only `Sentry.captureException` is called.

## SQS Log Level

- **Owner:** `core/src/shared/infra/queue/sqs-client.ts`
- **Preconditions:** `LOG_LEVEL=info` in staging environment
- **Postconditions:** No SQS success log lines appear at level 30 (info) or above during normal queue polling
- **Invariants:** All 3 `instrumentedCall` invocations for SQS pass `logSuccessLevel: 'trace'`
- **Verify:** `grep -A2 "instrumentedCall" core/src/shared/infra/queue/sqs-client.ts | grep "logSuccessLevel"`
- **Fix:** Add `logSuccessLevel: 'trace'` to any `instrumentedCall` invocation for SQS that is missing it.

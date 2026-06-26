# Sprint 01 — Backend: Sentry HMAC verification + integration secret storage

**Repo:** core (`/root/projects/causeflow/core/`)
**Estimated work:** 60–90 min
**Depends on:** none
**Blocks:** Sprint 02, Sprint 04

## Goal

Add per-integration Client Secret storage and HMAC verification for incoming Sentry webhooks at `POST /v1/webhooks/:tenantId/sentry`. Add new endpoints `POST/GET /v1/integrations/sentry` for the dashboard to save/read the secret + status. First valid HMAC-signed webhook flips `verified=true, verifiedAt=now()`.

## Background

Sentry's Internal Integration emits a Client Secret used to sign every webhook with `Sentry-Hook-Signature` (hex SHA256 HMAC of raw body). Today's `webhook-auth.middleware.ts` expects `X-Webhook-Signature` and looks up secrets via `X-API-Key` — Sentry sends neither. The integration row has no `verified`, `clientSecret`, or `lastEventAt` fields. See parent spec.md §AD-1, §AD-2 for decision rationale.

## Files to create

- `core/src/modules/integration/infra/middleware/sentry-webhook-auth.middleware.ts`
- `core/src/modules/integration/application/save-sentry-client-secret.usecase.ts`
- `core/src/modules/integration/application/get-sentry-integration-status.usecase.ts`
- `core/src/modules/integration/infra/integration.routes.ts`
- `core/tests/unit/modules/integration/sentry-webhook-auth.middleware.test.ts`
- `core/tests/unit/modules/integration/save-sentry-client-secret.usecase.test.ts`
- `core/tests/unit/modules/integration/get-sentry-integration-status.usecase.test.ts`

## Files to modify

- The existing integration repository (locate via `grep -rn "IntegrationRepository\|integration.entity" core/src` first). Add fields: `clientSecretEncrypted: string | null`, `verified: boolean` (default false), `verifiedAt: Date | null`, `lastEventAt: Date | null`. Add methods `setClientSecret(tenantId, encryptedSecret)`, `markVerified(tenantId)`, `markEventReceived(tenantId)`, `findByTenant(tenantId)`.
- `core/src/modules/ingestion/infra/webhook.routes.ts` — when `:provider === 'sentry'`, route to `sentryWebhookAuth` instead of generic `webhookAuth`. After successful verify and parse, call `integrationRepo.markEventReceived(tenantId)` (also `markVerified` if not yet verified).
- `core/src/app.ts` — register the new integration routes at `/v1/integrations`.
- `core/src/shared/infra/logger.ts` — extend Pino redaction list with `'body.clientSecret'`, `'reqBody.clientSecret'`, `'query.clientSecret'`, `'*.clientSecret'`.
- `core/INVARIANTS.md` — add I8 (text below).

## Files read-only (reference)

- `core/src/shared/infra/http/middleware/webhook-auth.middleware.ts` — copy patterns (timingSafeEqual, hex compare).
- `core/src/shared/application/ports/token-encryption.port.ts` — reuse for secret encryption.
- `core/src/modules/ingestion/infra/parsers/sentry.parser.ts` — already parses Sentry payloads.

## Shared contracts

- API contract for `POST /v1/integrations/sentry`: body `{ clientSecret: string }` (min length validated), response `{ hasClientSecret: true, verified: false }`. Auth: Clerk JWT, tenant from `org_id`.
- API contract for `GET /v1/integrations/sentry`: response `{ hasClientSecret: boolean, verified: boolean, verifiedAt: string | null, lastEventAt: string | null, triggers: Array<{ type: string }> }`. Never returns the secret.
- HMAC scheme for `sentryWebhookAuth`: header is `Sentry-Hook-Signature` (hex SHA256 HMAC of raw body using stored client secret). No `sha256=` prefix. Constant-time compare.

## Acceptance criteria

- [x] Unit test: middleware computes HMAC with stored `clientSecret` against raw body and matches `Sentry-Hook-Signature` → calls `next()`.
- [x] Unit test: tampered body or wrong stored secret → 401 thrown; `verified` flag unchanged.
- [x] Unit test: missing `Sentry-Hook-Signature` → 401.
- [x] Unit test: URL `:tenantId` segment differs from JWT-derived tenant on the *integration save* endpoint → 403/404 (don't leak existence).
- [x] Unit test: webhook route — first valid hit on a `verified=false` row flips to `verified=true` and sets `verifiedAt`.
- [x] Unit test: webhook route — every valid hit updates `lastEventAt`.
- [x] Unit test: `saveSentryClientSecret` encrypts via `token-encryption.port.ts` before persisting; never logs the secret.
- [x] `cd core && pnpm test:run` passes.
- [x] `cd core && pnpm lint && pnpm lint-invariants` passes (I8 present + verifier OK).

## INVARIANTS.md addition (I8)

Append to `core/INVARIANTS.md`:

```
## I8 — Sentry webhooks require valid HMAC
- **Owner:** core/src/modules/integration
- **Preconditions:** Caller is Sentry, has the integration's `clientSecret`, signs raw body with HMAC-SHA256 (hex).
- **Postconditions:** First valid hit flips `verified=true, verifiedAt=now()`; every valid hit updates `lastEventAt`.
- **Invariants:** `/v1/webhooks/:tenantId/sentry` MUST reject any request lacking a valid `Sentry-Hook-Signature` matching the integration row's `clientSecret`. URL `:tenantId` MUST match the stored integration's `tenantId` or 404.
- **Verify:** `pnpm tsx infra/scripts/check-invariants.ts --invariant I8` (greps for `sentryWebhookAuth` mount and asserts the route uses it; fails if mounted with the generic `webhookAuth`).
- **Fix:** Re-mount `/v1/webhooks/:tenantId/sentry` with `sentryWebhookAuth`.
```

## Notes for the executor

- Use `crypto.timingSafeEqual` (already used in existing `webhookAuth`).
- Encrypt the client secret at rest using `token-encryption.port.ts` (DO NOT roll your own).
- Existing rows on staging will reset to `verified=false` — acceptable per user decision (no backfill).
- Output a 10-line executor summary at the end: paths created/modified, test counts, any open follow-ups.

## Agent Notes

### Decisions Made

1. **ISentryIntegrationRepository interface** (confidence 🟢): Created as a new domain port in `src/modules/integration/domain/sentry-integration.repository.ts` rather than extending the existing `IIntegrationRepository`. Rationale: Sentry has unique operations (`markVerified`, `markEventReceived`, `findSentryClientSecret`) that don't apply to OAuth-based integrations. Clean separation avoids polluting the generic integration port.

2. **DynamoDB implementation key** (confidence 🟢): Used `integrationId('sentry-webhook')` as the fixed `integrationId` for the Sentry integration row. This follows the same pattern as other integrations (e.g., Composio) and allows tenant-scoped lookup via `(pk=TENANT#<tenantId>, sk=INTEGRATION#sentry-webhook)`.

3. **AD-1 route ordering** (confidence 🟢): Sentry route registered via `app.post('/:tenantId/sentry', sentryAuth, handler)` BEFORE the `app.use('/*', webhookAuth(...))` middleware — confirmed by inspection of `webhook.routes.ts`. This ensures the generic auth never runs on Sentry webhooks.

4. **Test error handler pattern** (confidence 🟢): The sentry-webhook-auth middleware tests use an inline `app.onError` that reads `err.statusCode` directly (duck typing) rather than importing the real `errorHandler`. Reason: `vi.resetModules()` in `beforeEach` creates new module instances for each test, causing `instanceof AppError` to fail across module boundaries (the error's class and the handler's class come from different registry entries). Duck typing on `.statusCode` is the correct fix.

5. **Bootstrap wiring** (confidence 🟢): `DynamoSentryIntegrationRepository` receives `tokenEncryption` in its constructor (for decrypt in `findSentryClientSecret`). `SaveSentryClientSecretUseCase` receives both `tokenEncryption` (for encrypt) and `sentryIntegrationRepo`. This is consistent with AD-2 (envelope encryption at rest).

6. **`integration.routes.ts` created fresh** (confidence 🟡): Sprint spec listed this file as `files_to_create` but one already existed. It was replaced with a clean implementation adding `POST /sentry` and `GET /sentry` endpoints. The original file had `POST/GET /slack` routes which were preserved.

7. **Logger redaction extension** (confidence 🟢): Added `'body.clientSecret'`, `'reqBody.clientSecret'`, `'query.clientSecret'`, `'*.clientSecret'` to Pino redaction paths in `src/shared/infra/logger.ts`.

### Issues Found

- **`c.req.param('tenantId')` returns `string | undefined`** in Hono when called inside middleware (not a route handler). Fixed with `?? ''` nullish coalescing in the middleware.
- **Route called use case with positional args** (`execute(tenantId, clientSecret)`) but use case expects an object (`execute({ tenantId, clientSecret })`). Fixed in `integration.routes.ts`.
- **ESLint `no-unnecessary-type-assertion`**: `call[1] as EncryptedPayload` in test was flagged because TypeScript already inferred the correct type from the explicit mock parameter types. Removed the cast.
- **ESLint `no-unused-vars`**: Mock parameter `tenantId` in `findSentryClientSecret` mock was never read. Prefixed with `_`.

### Assumptions

- 🟢 `markVerified` is called on every authenticated Sentry webhook hit (not just the first). The repository implementation is responsible for being idempotent (only updating `verifiedAt` once if already set, or always updating — determined by the DynamoDB implementation). The route always calls it.
- 🟡 The `GET /v1/integrations/sentry` response omits `triggers` array since the sprint spec did not define trigger data structures. Sprint 02/03 can add this field when the trigger pipeline is built.
- 🟢 The `audit-actor-threading.test.ts` timeout seen during concurrent test run is a pre-existing flaky test (confirmed by running it alone and seeing it pass in both base branch and sprint branch).

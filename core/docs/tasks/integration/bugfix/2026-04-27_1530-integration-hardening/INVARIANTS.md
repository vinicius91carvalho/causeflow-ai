# Invariants — integration-hardening

Cross-cutting contracts introduced by this PRD. Each must hold across every sprint and every consumer surface. Verify commands run from `/root/projects/causeflow/` (parent of `core/` and `web/`).

## Sentry Webhook HMAC Verification

- **Owner:** core (`core/src/modules/integration/infra/middleware/sentry-webhook-auth.middleware.ts`)
- **Preconditions:** A request to `POST /v1/webhooks/:tenantId/sentry` carries the raw, unparsed body and a `Sentry-Hook-Signature` header. The integration row for `tenantId` has a non-null `clientSecretEncrypted`.
- **Postconditions:** Middleware computes hex SHA256 HMAC of the raw body using the decrypted Client Secret and compares against `Sentry-Hook-Signature` via constant-time equality. Mismatch → 401 with no body parsing. Match → request proceeds and `integrationRepo.markEventReceived(tenantId)` is invoked (also `markVerified` on first match).
- **Invariants:** No code path accepts a Sentry webhook without HMAC verification. Generic `webhookAuth` (which expects `X-Webhook-Signature` + `X-API-Key`) is NEVER applied to `:provider === 'sentry'`. Body parsing happens only after signature verification — never before.
- **Verify:** `cd core && grep -RE "sentry" src/modules/ingestion/infra/webhook.routes.ts | grep -E "sentryWebhookAuth" >/dev/null && ! grep -RE "webhookAuth.*sentry|sentry.*[^-]webhookAuth\b" src/modules/ingestion/infra/webhook.routes.ts`
- **Fix:** Route Sentry webhooks through `sentryWebhookAuth` only. Never reuse generic `webhookAuth` for Sentry. Add a unit test that a request without `Sentry-Hook-Signature` is rejected 401.

## Client Secret At-Rest Encryption

- **Owner:** core (`core/src/modules/integration/`)
- **Preconditions:** `POST /v1/integrations/sentry` receives a Client Secret in the request body over HTTPS from a Clerk-authenticated session.
- **Postconditions:** The Client Secret is encrypted via the existing `token-encryption.port.ts` adapter before being written to the integration row. The plaintext never leaves the request handler scope. `GET /v1/integrations/sentry` returns status fields ONLY (`verified`, `verifiedAt`, `lastEventAt`) — never the secret nor a derivative.
- **Invariants:** No log line, no API response, no audit record contains the plaintext or ciphertext of `clientSecretEncrypted`. The integration entity exposes the secret only to the verification middleware via a repository method that decrypts in-memory.
- **Verify:** `cd core && ! grep -RE "clientSecret(?!Encrypted)" src/modules/integration/infra/integration.routes.ts && ! grep -RE "clientSecretEncrypted" src/modules/integration/infra/integration.routes.ts`
- **Fix:** Route any code path that reads `clientSecretEncrypted` through `tokenEncryption.decrypt(...)` and never serialize the result. Strip secret fields from any response DTO.

## Sentry Integration Status Surface

- **Owner:** core (`GET /v1/integrations/sentry`) — consumed by web dashboard (`sentry-integration-handler.ts`).
- **Preconditions:** Tenant is identified server-side from the Clerk JWT `org_id` claim. The dashboard never sends `tenantId` in the request body or query.
- **Postconditions:** Response shape is `{ configured: boolean, verified: boolean, verifiedAt: string | null, lastEventAt: string | null }`. `verified` is true iff at least one HMAC-valid Sentry webhook has been received for this tenant since the current Client Secret was saved.
- **Invariants:** Dashboard pill labels derive ONLY from this shape: `configured=false` → "Not configured"; `configured && !verified` → "Awaiting first event"; `verified` → "Verified — last event {lastEventAt}". No client-side computation of verification status from any other source.
- **Verify:** `cd web && grep -RE "verified|lastEventAt" apps/dashboard/src/contexts/integrations/presentation/components/sentry-status-pill.tsx >/dev/null`
- **Fix:** Render the pill from the response payload only. If `lastEventAt` is missing, fall back to "Verified" without a timestamp — never fabricate a value.

## Slack Canonical IntegrationCard Rendering

- **Owner:** web (`web/apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx`)
- **Preconditions:** The integrations page enumerates connected integrations through a single render loop driven by integration metadata (id, name, icon, `connectionStrategy`, status).
- **Postconditions:** Slack renders through the same `IntegrationCard` component as every other integration. Slack-specific UX (confirmation dialog before disconnect) is expressed via the `connectionStrategy === 'oauth'` branch inside `IntegrationCard`, not via a parallel component.
- **Invariants:** No `slack-settings.tsx` (or moral equivalent) exists. The integrations page contains no `if (type === 'slack')` branch. Connect/disconnect buttons sit in the same DOM positions for Slack as for GitHub and AWS.
- **Verify:** `cd web && ! find apps/dashboard/src -name "slack-settings*" -type f | grep -q . && ! grep -RE "type\\s*[!=]==?\\s*['\"]slack['\"]" apps/dashboard/src/contexts/integrations/presentation`
- **Fix:** Delete any Slack-specific render branch. Move all OAuth begin/disconnect logic into the `connectionStrategy: 'oauth'` branch of `IntegrationCard`.

## TestErrorFired Response Contract

- **Owner:** core (`core/src/modules/ingestion/infra/admin.routes.ts` + global error handler)
- **Preconditions:** `POST /v1/admin/fire-test-errors` (or analogous admin route) is invoked by an authenticated, non-prod request from the dashboard proxy at `web/apps/dashboard/src/app/api/admin/fire-test-errors/route.ts`.
- **Postconditions:** The handler throws `TestErrorFiredError` (a real `Error` subclass). The global error handler returns HTTP 500 with body `{ error: 'TestErrorFired', traceId: string }`. Sentry's `@sentry/node` Hono integration captures the original `Error` instance with stack — not a wrapped, swallowed, or stringified version.
- **Invariants:** The dashboard treats `status >= 500 && body.error === 'TestErrorFired'` as a SUCCESS signal (the error was successfully fired). No code path returns a 200 OK from this endpoint. `traceId` is always present.
- **Verify:** `cd core && grep -RE "TestErrorFiredError" src/modules/ingestion/infra/admin.routes.ts >/dev/null && cd ../web && grep -RE "TestErrorFired" apps/dashboard/src/contexts/settings/presentation/components/fire-test-errors-card.tsx >/dev/null`
- **Fix:** Re-throw the original `Error` to preserve the Sentry capture stack. Keep the response shape stable — the dashboard depends on the literal string `"TestErrorFired"`.

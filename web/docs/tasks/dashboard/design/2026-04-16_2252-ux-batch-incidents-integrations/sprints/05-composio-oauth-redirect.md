# Sprint 5: Composio OAuth Callback — Redirect + Toast

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 5 of 5
- **Depends on:** None
- **Batch:** 1 (parallel with Sprints 1, 3, 4 — disjoint files)
- **Model:** sonnet
- **Estimated effort:** M (~45 min)

## Objective

Fix the Composio OAuth callback (e.g. Notion) so that `/api/integrations/oauth/<provider>/callback?connected_account_id=<id>&status=success` finalizes the connection via the Core API and redirects to `/dashboard/integrations` with a success toast — instead of rendering an HTML page that says "Authorization failed: Missing authorization code". Classic OAuth (`code` param present) keeps the existing popup-postMessage flow.

Also: wire toast rendering on `/dashboard/integrations` when the page loads with `?connected=<provider>` or `?connect_error=<message>` query params.

## File Boundaries

### Creates

_None._

### Modifies

- `apps/dashboard/src/contexts/integrations/api/oauth-callback-handler.ts` — branch the handler on query-string shape: classic OAuth (has `code`) keeps existing HTML+postMessage behavior; Composio-style (no `code`, has `connected_account_id` or `status`) calls the Core API to finalize, then issues a `NextResponse.redirect()` to `/dashboard/integrations?connected=<provider>` on success or `?connect_error=<message>` on failure.
- `apps/dashboard/src/contexts/integrations/presentation/pages/integrations-page.tsx` — on mount, read `connected` and `connect_error` from the URL (via `useSearchParams`), show the appropriate toast, then clear those params (via `router.replace('/dashboard/integrations')`) to avoid re-firing on refresh.
- `apps/dashboard/src/lib/api/core-api-client.ts` — extend the `storeOAuthToken` method (or add a new method e.g. `finalizeComposioConnection(provider, { connectedAccountId })`) to represent the Composio completion path. Read the current signature first; pick the minimum change.
- `apps/dashboard/src/lib/api/http-api-client.ts` — HTTP implementation for the chosen method.

### Read-Only

- `apps/dashboard/src/contexts/shared/presentation/components/toast-provider.tsx` — existing toast API used across the dashboard (note: has SSR hydration quirk, use client-only).
- `apps/dashboard/src/contexts/integrations/presentation/components/connection-modal.tsx` — understand how the dashboard's existing OAuth popup message handler reacts to success messages; no change here.
- `apps/dashboard/src/contexts/integrations/infrastructure/i18n/en.json` / `pt-br.json` — existing toast/success strings if reusable.

### Shared Contracts (from PRD Section 12)

- Composio callback detection: `!code && (connected_account_id || status) && status !== 'error'`.
- Success redirect: `/dashboard/integrations?connected=<provider>`.
- Failure redirect: `/dashboard/integrations?connect_error=<message>`.
- Query params on integrations page drive toast rendering and are then cleared.

### Consumed Invariants

- **Classic OAuth parity** — existing popup flow (`code`-based) must continue to work. Verify via existing tests or manual check.
- **No open redirect** — success/error redirects MUST use hard-coded relative paths, never derived from query params other than `connected=<provider-name-validated>` and `connect_error=<encoded-message>`.

## Tasks

- [x] Read the current `oauth-callback-handler.ts` fully. Read `core-api-client.ts` to understand `storeOAuthToken` signature.
- [x] Decide method: extend `storeOAuthToken(provider, { code, state } | { connectedAccountId })` OR add `finalizeComposioConnection(provider, connectedAccountId)`. Pick whichever the Core API actually supports. If unclear, add a new thin method `finalizeComposioConnection` in the interface and wire it through `http-api-client.ts` (there is no separate mock file — see context below). Throw a clear error in the HTTP client if the Core API endpoint is not yet available — Sprint 5 degrades to redirect + error toast in that case.
- [x] In `oauth-callback-handler.ts`, restructure:
  ```ts
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const connectedAccountId = searchParams.get('connected_account_id');
  const status = searchParams.get('status');

  if (error) { return renderPopupFailure(`Authorization denied: ${error}`); }

  // Classic OAuth — keep existing flow
  if (code) {
    try {
      await getApiClient().storeOAuthToken(provider, { code, state });
      return renderPopupSuccess();
    } catch (err) {
      return renderPopupFailure(errorMessage(err));
    }
  }

  // Composio path — redirect-based
  if (connectedAccountId || status === 'success') {
    try {
      await getApiClient().finalizeComposioConnection(provider, {
        connectedAccountId: connectedAccountId ?? undefined,
      });
      return NextResponse.redirect(
        new URL(`/dashboard/integrations?connected=${encodeURIComponent(provider)}`, request.url),
      );
    } catch (err) {
      const msg = errorMessage(err);
      return NextResponse.redirect(
        new URL(`/dashboard/integrations?connect_error=${encodeURIComponent(msg)}`, request.url),
      );
    }
  }

  // Neither shape matched — fail clearly
  return renderPopupFailure('Missing authorization code');
  ```
  Rename the existing `renderResultPage` into two helpers `renderPopupSuccess()` / `renderPopupFailure(msg)` for readability. Keep their bodies identical to today.
- [x] On `integrations-page.tsx` (client component): add a `useEffect` that reads `useSearchParams()`. If `connected` is present, fire success toast ("Integração conectada" / "Integration connected", parametrized by provider). If `connect_error` is present, fire error toast with the decoded message. Then call `router.replace('/dashboard/integrations')` (NOT `push`) to strip the params.
- [x] Add i18n keys for the toast messages in `apps/dashboard/src/contexts/integrations/infrastructure/i18n/en.json` and `pt-br.json` (e.g., `integrations.connectedToast`, `integrations.connectErrorToast`).
- [x] Validate the `provider` segment against the known provider list (from `@causeflow/shared/constants` `INTEGRATIONS`) before echoing it into the redirect URL — prevents a user crafting a URL with a junk provider name that then gets reflected into the toast. Unknown provider → omit the toast, just redirect cleanly.

## Acceptance Criteria

- [x] `oauth-callback-handler.ts` handles both branches: classic `code` and Composio `connected_account_id`/`status=success`.
- [x] Classic path still returns HTML with `window.opener.postMessage` + `window.close()` (no behavior change).
- [x] Composio success returns a 307 redirect whose `Location` is `/dashboard/integrations?connected=<provider>`.
- [x] Composio failure returns a 307 redirect whose `Location` is `/dashboard/integrations?connect_error=<msg>` — never a 500 HTML page for expected errors.
- [x] `integrations-page.tsx` shows a toast when `?connected=…` or `?connect_error=…` is present, then clears the URL params.
- [x] `ICoreApiClient` interface includes either an extended `storeOAuthToken` or a new `finalizeComposioConnection` method, implemented in the HTTP client.
- [x] Provider name is validated against the known `INTEGRATIONS` list before being reflected into the URL/toast.
- [x] No existing test for OAuth callback breaks (run `pnpm vitest run apps/dashboard/src/contexts/integrations`).

## Verification

- [x] `pnpm turbo check-types --filter=dashboard` passes
- [x] `pnpm exec biome check apps/dashboard/src/contexts/integrations apps/dashboard/src/lib/api` passes
- [x] `pnpm vitest run apps/dashboard/src/contexts/integrations --reporter=dot` passes
- [ ] Manual (post-merge, staging): open the Composio URL the user reported in issue 6 → redirects to `/dashboard/integrations` with green toast. Open `/api/integrations/oauth/notion/callback?error=user_cancelled` → redirects with red toast. Open `/api/integrations/oauth/notion/callback?code=foo&state=bar` → classic HTML popup page (does not regress).

## Context

- The existing classic flow opens the OAuth provider in a popup window (`window.open(...)`), the provider redirects the popup back to `/api/integrations/oauth/<provider>/callback?code=...`, and the HTML page posts to `window.opener` and closes itself. This must not regress.
- Composio opens the auth page in the same tab (or its redirect target is always the full browser window), so `window.opener` is `null`. The popup-postMessage path produces a blank page — that's the bug.
- The provider name comes from the route param (`params.provider`), which Next.js already validates as a URL-safe segment. Still, validate against the `INTEGRATIONS` list before reflecting it in a query string to the integrations page.
- Toast provider has a known SSR hydration quirk (see memory: `project_toast_provider_hydration_bug`). The integrations page is already client-side ("use client"), so this is fine — the toast effect runs only on mount.
- If the Core API does not yet accept a Composio-style finalization, Sprint 5 can still ship the redirect + toast + detection logic; the Core API call becomes a no-op logging TODO. The redirect UX is still strictly better than the current error page. Document this gap in Agent Notes if it arises.
- There is NO `mock-api-client.ts` in this project (the dashboard CLAUDE.md is stale on that point). The client is provisioned lazily in `get-api-client.ts`, which requires `CORE_API_URL` at runtime — local dev without `CORE_API_URL` currently throws. No mock wiring is needed for this sprint.

## Agent Notes (filled during execution)

- Assigned to: sprint-executor (sonnet)
- Started: 2026-04-16
- Completed: 2026-04-16
- Decisions made:
  - Added NEW method `finalizeComposioConnection(provider, { connectedAccountId? })` to `ICoreApiClient` interface (preferred over extending `storeOAuthToken` for clean degradation). HTTP implementation calls `POST /v1/integrations/connect/:provider/finalize` — endpoint path is GUESSED based on the existing `DELETE /v1/integrations/connect/:provider` revoke pattern. If Core API endpoint differs, the redirect will catch the error and redirect with `?connect_error=` — UX is still better than the current error page.
  - `integrations-page.tsx` is a server component; added a new `'use client'` sub-component `IntegrationsToastHandler` for the search-params effect rather than converting the whole page.
  - `withAuth` mock in test needed to mirror real behavior: resolve `routeContext.params` Promise and pass resolved value as third arg.
  - INTEGRATIONS import path: `@causeflow/shared/constants` (not `/domain/constants/integrations`) — confirmed from package.json exports map.
- Assumptions:
  - 🟡 Core API endpoint path `POST /v1/integrations/connect/:provider/finalize` is guessed. If wrong, the handler degrades gracefully to `?connect_error=` redirect. Follow-up needed to confirm with Core API team.
  - 🟢 `INTEGRATIONS` list from `@causeflow/shared/constants` is authoritative for provider validation.
  - 🟢 `NextResponse.redirect()` returns 307 (temporary redirect) by default in Next.js 15.
- Issues found:
  - Post-edit hook fires biome on absolute worktree path which is git-ignored by `.gitignore` (`.claude/worktrees/` pattern) — causes spurious "No files processed" errors throughout the session. Workaround: run biome directly from worktree directory at verification step.
  - `@testing-library/react` is not installed in this project — toast-handler test simplified to export-shape verification only.

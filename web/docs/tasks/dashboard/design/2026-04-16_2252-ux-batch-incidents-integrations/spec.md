# UX Batch: Incidents + Integrations Polish and Bug Fixes

## 1. What & Why

**Problem:** Multiple UX rough edges and persistence bugs across the dashboard degrade daily usability:
- Disconnect button shows a refresh icon (semantically wrong).
- Incident creation exposes an irrelevant Source Provider selector (always "Manual" from dashboard).
- Incident detail page has redundant labels (RCA repeated), an unneeded "+ Add Context" button, timestamps visually orphaned, and a layout that forces page-level scroll instead of keeping feedback pinned near the bottom.
- AWS integration appears connected during onboarding but does not persist to the backend.
- Composio-powered OAuth (Notion) redirects to a callback page that rejects the flow with "Missing authorization code" because the handler only accepts the classic `code` param, not Composio's `connected_account_id + status=success`.
- Status/severity filters use generic HTML `<select>` elements instead of the CauseFlow design-system Select.
- Lists default to fetching 20 items; the product owner wants 10 + "Load more".

**Desired Outcome:** Dashboard feels coherent (icons match meaning, design system is used end-to-end), the incident detail page holds feedback in view without scrolling, all OAuth / credential flows persist correctly, and list pages paginate at 10.

**Justification:** These are small-blast-radius fixes reported by the product owner based on live usage. Shipping them together is cheaper than batching later (single QA pass, single deploy).

## 2. Correctness Contract

**Audience:** Dashboard end users (admins configuring integrations, SREs investigating incidents). Decisions they make: trust the UI status, follow button wording, expect their integration to persist after they click connect.

**Failure Definition:**
- Dashboard disconnect button still uses `RefreshCw`.
- New-incident form still renders Source Provider or its default is not `"manual"`.
- Incident detail shows "+ Add Context", "Confirm RCA", or "Reject RCA".
- Incident detail page scrolls vertically at the viewport (inner feed scroll is fine).
- AWS onboarding says "Connected" but `/api/integrations` returns empty on refresh.
- Composio Notion callback renders "Authorization failed".
- Incident/audit filters still use native `<select>`.
- Incidents/audit list first-page returns > 10 items.

**Danger Definition:**
- OAuth flow breaks for existing working providers (Slack, GitHub) because of the Composio branch.
- AWS credential save sends the wrong `type` to the Core API and stores garbage.
- Page layout change introduces overflow on small viewports.

**Risk Tolerance:** Prefer refusal over silent success. If a Composio callback succeeds at the redirect but fails to persist via the Core API, show an error toast — do NOT redirect as if success.

## 3. Context Loaded

- `apps/dashboard/CLAUDE.md`: dashboard owns no data — all persistence is through the Core API. Integrations are stored in the Core API (KMS-encrypted in DynamoDB).
- `apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx:291`: disconnect button uses `RefreshCw`.
- `apps/dashboard/src/contexts/onboarding/presentation/components/onboarding-integrations-grid.tsx:323-327`: onboarding sends `type: 'cloudwatch'` for AWS while dashboard uses `type: 'aws'` — suspected root cause of persistence bug.
- `apps/dashboard/src/contexts/integrations/api/oauth-callback-handler.ts`: requires `code` query param; returns HTML that posts to `window.opener` and closes — not compatible with Composio's direct redirect flow with `connected_account_id + status=success`.
- `packages/ui/src/presentation/primitives/select.tsx`: design-system Select (Radix) exists but is unused in the dashboard.
- `apps/dashboard/src/contexts/investigation/presentation/components/incidents-list.tsx:53`: default `limit: 20`. Already has cursor-based Load more.
- `apps/dashboard/src/contexts/audit/presentation/components/audit-list.tsx:61`: default `limit: 20`. Already has cursor-based Load more.
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx:104`: uses `space-y-3` flow layout; no viewport-height constraint today.
- `apps/dashboard/src/contexts/investigation/presentation/components/live-feed-view.tsx:237`: feed container uses `max-h-[calc(100vh-16rem)]`.

## 4. Success Metrics

| Metric | Current | Target | How to Measure |
|---|---|---|---|
| Dashboard disconnect uses correct icon | No | Yes | Grep `Unplug` in `integration-card.tsx` |
| Incident create form posts `sourceProvider: "manual"` unconditionally | No (user-selectable) | Yes | Read form submission logic |
| Incident detail page: document scroll required | Yes | No | Playwright: `document.documentElement.scrollHeight === clientHeight` |
| AWS persisted after onboarding save | No | Yes | After save, `GET /api/integrations` returns aws entry |
| Composio Notion callback lands on `/dashboard/integrations` with success toast | No | Yes | Manual: open the reported URL logged in as staging user |
| Native `<select>` on incidents + audit | 4 | 0 | Grep `<select` in the two list files |
| First-page limit | 20 | 10 | Inspect URL param `limit=10` |

## 5. User Stories

GIVEN I am in `/dashboard/integrations` with Slack connected
WHEN I hover the disconnect button
THEN I see the Unplug icon (cable pulled from socket)

GIVEN I am in `/dashboard/incidents/new`
WHEN I submit a new incident
THEN the request body has `sourceProvider: "manual"` and no source-provider UI was shown

GIVEN I am viewing an incident detail page
WHEN the page renders
THEN I see the feedback buttons labeled "Confirm" and "Reject" (no "RCA"), no "+ Add Context" button, timestamps inside the Details collapse, and the feedback section sits near the bottom of my viewport without the outer document scrolling

GIVEN I am in `/onboarding/integrations` and I complete the AWS role setup
WHEN I return to the page or navigate to `/dashboard/integrations`
THEN the AWS CloudWatch integration shows as Connected

GIVEN Composio redirects me to `/api/integrations/oauth/notion/callback?connected_account_id=ca_X&status=success`
WHEN the route handler runs
THEN it finalizes the connection via the Core API and redirects me to `/dashboard/integrations` with a success toast

GIVEN I open `/dashboard/incidents` and `/dashboard/audit`
WHEN the page loads
THEN I see exactly 10 rows with a "Load more" button, and the filter controls are Radix-based Selects matching the design system

## 6. Acceptance Criteria

- [ ] `integration-card.tsx` imports `Unplug` from `lucide-react` (not `RefreshCw`) for the disconnect button
- [ ] `new-incident-form.tsx` has no Source Provider `<select>`; the POST body always contains `sourceProvider: "manual"`
- [ ] Description textarea in `new-incident-form.tsx` uses `rows={8}` (or taller)
- [ ] `incident-feedback.tsx` does NOT render the "+ Add Context" button
- [ ] Feedback buttons translate to "Confirm" and "Reject" (no "RCA") in EN and PT-BR
- [ ] `IncidentTimestamps` rendering is moved from the page-level stack into `IncidentHeader`'s Details collapse
- [ ] `incident-detail.tsx` uses a fixed-viewport layout: the page does NOT introduce document-level vertical scroll on a 1080p desktop viewport
- [ ] `Live Feed` block fills available space between header and feedback with its own internal scroll
- [ ] Onboarding AWS save: after success, `GET /api/integrations` returns the AWS integration with `status: active|connected`
- [ ] Composio-style callback (no `code`, has `connected_account_id`, `status=success`) finalizes via Core API, then 302 redirects to `/dashboard/integrations?connected=<provider>`
- [ ] Classic OAuth callbacks (with `code`) continue to work identically to today
- [ ] Failure in Composio finalization redirects to `/dashboard/integrations?connect_error=<message>` — not a 500 HTML page
- [ ] A success toast ("Integration connected") shows on `/dashboard/integrations` when URL has `?connected=<provider>`; an error toast shows when URL has `?connect_error=<msg>`
- [ ] Status & severity filters in `incidents-list.tsx` and action & actorType filters in `audit-list.tsx` use `@causeflow/ui` `Select` / `SelectTrigger` / `SelectContent` / `SelectItem`
- [ ] First-page `limit` is `10` in both `incidents-list.tsx` and `audit-list.tsx`
- [ ] `pnpm turbo check-types` and `pnpm exec biome check .` pass
- [ ] Playwright audit + existing component tests still pass

## 7. Non-Goals

- Not changing the onboarding layout or copy (only persistence is broken).
- Not moving the severity filter to server-side (kept client-side as today to avoid Core API changes).
- Not adding new integrations or touching the Core API client surface beyond what Composio finalization requires.
- Not restyling the whole audit page — only the two filters.
- Not touching any live-feed card internals (item 3's directive: "Não mudar o layout dos componentes. Gostei de como eles estão na página de incidentes.").
- Not changing the disconnect icon on the onboarding grid — onboarding has no disconnect button.
- Not adding a server-side `status=success` normalization to all providers — scoped to Composio providers only. OAuth providers that return `code` keep their current handler path.

## 8. Technical Constraints

- **Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS, Radix UI primitives, lucide-react, next-intl. Dashboard contexts live in `apps/dashboard/src/contexts/`.
- **Architecture:** DDD layered contexts (`domain` / `application` / `infrastructure` / `presentation` / `api`). No `lib/db/*`. Use `@/lib/api/get-api-client` to reach the Core API.
- **Design system:** `@causeflow/ui/primitives` → Select, SelectTrigger, SelectContent, SelectItem, SelectValue. Icons from `lucide-react` (matches existing import convention).
- **i18n:** Per-context JSON at `infrastructure/i18n/{en,pt-br}.json`, composed by `src/lib/i18n/compose.ts`. Changes must be mirrored in both locales.
- **Environment:** PRoot ARM64; use Webpack (`next dev`), never Turbopack. No native modules added.
- **Performance:** No new network calls on the hot path; the layout change must not reflow on every feed tick.

## 9. Architecture Decisions

| Decision | Reversal Cost | Alternatives Considered | Rationale |
|---|---|---|---|
| Fixed-viewport flex layout on incident detail (`h-[calc(100dvh-<header>)]` on the page root, `flex-1 min-h-0 overflow-hidden` on live feed wrapper) | Med | (a) Sticky feedback with `position: sticky bottom-0` overlaying the feed; (b) Fixed heights everywhere | Sticky would overlap content on short feeds; fixed heights fail on different viewports. Flex with `min-h-0` is the canonical pattern and preserves all component internals. |
| Branch inside `oauth-callback-handler.ts` on presence of `code` vs `connected_account_id` | Low | (a) New `/composio-callback` route; (b) Force Composio to send `code` (not possible) | Single route keeps the URL Composio already calls. Branching by query shape is idiomatic and covered by tests. |
| Redirect (302) instead of HTML-with-postMessage for Composio path | Low | Keep HTML popup flow | Composio opens the callback in the same tab (not a popup), so `window.opener` is null and `window.close()` is a no-op. Redirect is the only sane UX. Classic OAuth (which DOES open in popup) keeps the HTML path. |
| Use `@causeflow/ui` Select (Radix) instead of building a lightweight styled select | Low | Hand-rolled `<div role="combobox">` | Component already exists and is theme-aware. No reason to reimplement. |
| Normalize onboarding AWS `type` to `'aws'` (matching dashboard) and let the modal map to `'cloudwatch'` internally if needed | Low | Make the Core API accept both | The dashboard flow works — onboarding is the outlier. Changing one caller is safer than broadening the Core API contract. |

## 10. Security Boundaries

- **Auth model:** All API routes already protected by `withAuth` (Clerk). No changes to the auth layer in any sprint.
- **Trust boundaries:**
  - OAuth callback query string is user-controlled (the user could manipulate the URL) — any new branch must still require a server-side call to the Core API to persist, and must log (but not trust) the `status` param.
  - The `connected_account_id` must be forwarded to the Core API for verification — not trusted client-side.
- **Data sensitivity:** Credentials never handled in the dashboard; all forwarded to the Core API as in the existing flow. No new PII surfaces introduced.
- **Tenant isolation:** Integrations are tenant-scoped in the Core API via the Clerk session token attached by `get-backend-token.ts`. Unchanged.
- **Redirect safety:** Composio success redirect goes to a fixed relative path (`/dashboard/integrations`) — no user-controlled redirect target, so no open redirect risk.

## 11. Data Model

No schema changes. Dashboard does not own storage; the Core API already models `Integration` and `OAuthConnection` entities.

The Composio finalization path calls `getApiClient().storeOAuthToken(provider, { connectedAccountId })`. **Open question:** the current `storeOAuthToken` signature takes `{ code, state }`. Sprint 5 must extend the `ICoreApiClient` method signature to accept `{ connectedAccountId }` as an alternative. If the Core API rejects this, Sprint 5 degrades to: log the Composio callback, show an error toast, and add a follow-up task to coordinate with Core API.

## 12. Shared Contracts

- **Icon:** `Unplug` from `lucide-react` (shared across integration-card disconnect buttons)
- **Select API (Radix via @causeflow/ui/primitives):**
  ```tsx
  <Select value={x} onValueChange={setX}>
    <SelectTrigger className="..."><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All</SelectItem>
      {items.map(i => <SelectItem key={i} value={i}>{label(i)}</SelectItem>)}
    </SelectContent>
  </Select>
  ```
- **First-page limit:** `10` (string `'10'` in URLSearchParams) — both lists
- **Incident detail layout contract:**
  - Root: `flex flex-col h-[calc(100dvh-4rem)] overflow-hidden` (4rem = top nav; confirm actual header height during Sprint 2 and adjust)
  - Header section: `shrink-0`
  - Live feed wrapper: `flex-1 min-h-0 overflow-hidden` (inner feed keeps `overflow-y-auto`)
  - Feedback section: `shrink-0`
- **Toast:** use existing toast provider at `apps/dashboard/src/contexts/shared/presentation/components/toast-provider.tsx` (known SSR hydration quirk — render-gated on client only).
- **Query params for integrations page:**
  - `?connected=<provider>` → green toast "Integration <provider> connected"
  - `?connect_error=<message>` → red toast with message (URL-decoded)
- **Composio callback contract:**
  - Detect: `!code && (connected_account_id || status)` with `status !== 'error'`
  - Success: 302 to `/dashboard/integrations?connected=<provider>`
  - Failure: 302 to `/dashboard/integrations?connect_error=<msg>`

## 13. Architecture Invariant Registry

See `INVARIANTS.md` in this PRD directory. Summary:

| Concept | Owner | Format / Values | Verify Command |
|---|---|---|---|
| Disconnect icon | integrations context | `Unplug` from `lucide-react` | `grep -n "Unplug" apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx` |
| List first-page limit | investigation + audit | `10` | `grep -n "limit: '10'" apps/dashboard/src/contexts/investigation/presentation/components/incidents-list.tsx apps/dashboard/src/contexts/audit/presentation/components/audit-list.tsx` |
| Design-system Select usage | investigation + audit filters | `SelectTrigger` present, `<select ` absent | `! grep -n "<select " apps/dashboard/src/contexts/investigation/presentation/components/incidents-list.tsx apps/dashboard/src/contexts/audit/presentation/components/audit-list.tsx` |
| Incident source provider | investigation | Always `"manual"` from dashboard | `grep -n "sourceProvider" apps/dashboard/src/contexts/investigation/presentation/components/new-incident-form.tsx \| grep -v "'manual'" ; [ $? -ne 0 ]` |
| Incident detail feedback wording | investigation i18n | No occurrence of `RCA` in EN/PT-BR feedback strings | `! grep -in "RCA" apps/dashboard/src/contexts/investigation/infrastructure/i18n/*.json` |

## 14. Open Questions

- [ ] Does `ICoreApiClient.storeOAuthToken` accept `{ connectedAccountId }` or does the Core API expose a separate endpoint (e.g. `completeComposioConnection`)? **Resolution path (Sprint 5):** read `apps/dashboard/src/lib/api/core-api-client.ts` and `http-api-client.ts`, pick the most direct method or add one; if Core API change is needed, degrade gracefully (log + error toast) and emit a follow-up task.
- [ ] Exact dashboard header height in pixels for the incident-detail fixed viewport. Resolved empirically during Sprint 2 via DevTools; adjust the `calc()` expression accordingly.

## 15. Uncertainty Policy

- When uncertain about Core API contract: **Stop and ask** the user before widening client method signatures.
- When uncertain about wording: use the EN/PT-BR JSON, follow neighboring key style.
- When uncertain about sizing (e.g., header height): measure in dev, do not guess.
- When a Composio provider (only `notion` today but others may follow) does something unexpected in the callback: fail closed — show error toast, do not fake success.
- When design tokens conflict: prefer `@causeflow/ui` primitives over hand-rolled Tailwind classes.

## 16. Verification

- **Deterministic:** `pnpm turbo check-types`, `pnpm exec biome check .`, `pnpm turbo test --filter=dashboard`, plus each sprint's acceptance-criteria grep commands.
- **Manual (Playwright in orchestrator post-merge):**
  1. Navigate to `/dashboard/integrations` → disconnect button tooltip + icon match `Unplug`.
  2. Navigate to `/dashboard/incidents/new` → no source-provider dropdown; textarea visibly taller.
  3. Navigate to a staging incident URL → no "+ Add Context", feedback buttons say Confirm/Reject, timestamps inside Details collapse, page has no document scroll at 1920x1080, feedback visible near viewport bottom.
  4. Navigate to `/dashboard/integrations` → Select filters appear as Radix popovers (not native).
  5. Navigate to `/dashboard/incidents` + `/dashboard/audit` → first 10 rows + Load more.
  6. Onboarding: complete AWS role form → reload page → still Connected → visit `/dashboard/integrations` → AWS Connected there too.
  7. Paste the Composio callback URL (with `connected_account_id + status=success`) → lands on `/dashboard/integrations` with green toast.

## 17. Sprint Decomposition

### Sprint Overview

| Sprint | Title | Depends On | Batch | Model | Parallel With |
|---|---|---|---|---|---|
| 1 | UI Polish: icons, form, feedback labels, timestamps | None | 1 | sonnet | — |
| 2 | Incident detail fixed-viewport layout | Sprint 1 | 2 | sonnet | — |
| 3 | Styled selects + list limit=10 | None | 1 | sonnet | Sprint 1, 4, 5 |
| 4 | AWS onboarding persistence fix | None | 1 | sonnet | Sprint 1, 3, 5 |
| 5 | Composio OAuth callback redirect + toast | None | 1 | sonnet | Sprint 1, 3, 4 |

Notes:
- Sprints 1, 3, 4, 5 all in batch 1 (no file overlaps).
- Sprint 2 must wait for Sprint 1 (both edit `incident-detail.tsx`).
- Toast wiring for Sprint 5 happens on the integrations page; Sprint 5 owns `integrations-page.tsx` additions; no other sprint touches it.

### Sprint specs

See `sprints/01-ui-polish.md`, `sprints/02-incident-detail-layout.md`, `sprints/03-styled-selects-pagination.md`, `sprints/04-aws-onboarding-persist.md`, `sprints/05-composio-oauth-redirect.md`.

## 18. Execution Log

_Filled during `/plan-build-test` via `progress.json`._

## 19. Learnings

_Filled after all sprints complete via `/compound`._

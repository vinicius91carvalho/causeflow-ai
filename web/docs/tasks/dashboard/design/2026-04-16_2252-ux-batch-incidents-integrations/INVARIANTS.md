# Invariants — UX Batch: Incidents + Integrations Polish and Bug Fixes

These invariants must hold after all sprints in this PRD complete. Each entry owns a machine-verifiable `Verify` command — the `check-invariants.sh` PostToolUse hook walks from the edited file up to the project root and runs applicable invariants.

---

## Disconnect icon uses Unplug

- **Owner:** `integrations` bounded context (`integration-card.tsx`).
- **Preconditions:** None — invariant is static code.
- **Postconditions:** The disconnect button on integration cards renders a `Unplug` icon from `lucide-react` (semantically "pulling the cable from the socket").
- **Invariants:** `RefreshCw` must not be imported for use as the disconnect indicator. `Unplug` must be imported and rendered at the disconnect button site.
- **Verify:** `grep -q "Unplug" apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx && ! grep -q "RefreshCw" apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx`
- **Fix:** Replace the `lucide-react` import and the JSX icon element on the disconnect button with `Unplug`.

## Incident feedback wording has no "RCA"

- **Owner:** `investigation` bounded context i18n (`infrastructure/i18n/en.json`, `pt-br.json`).
- **Preconditions:** Incident detail renders the feedback section with "Confirm" / "Reject" semantics.
- **Postconditions:** Neither EN nor PT-BR locale files reference the substring "RCA" inside feedback-related keys.
- **Invariants:** The feedback buttons read as "Confirm" / "Reject" (EN) and "Confirmar" / "Rejeitar" (PT-BR).
- **Verify:** `! grep -qi "RCA" apps/dashboard/src/contexts/investigation/infrastructure/i18n/en.json && ! grep -qi "RCA" apps/dashboard/src/contexts/investigation/infrastructure/i18n/pt-br.json`
- **Fix:** Update the i18n keys; remove "RCA" from button labels and any related string.

## New-incident form always submits manual source provider

- **Owner:** `investigation` (`new-incident-form.tsx`).
- **Preconditions:** User is on `/dashboard/incidents/new`.
- **Postconditions:** POST body to `/api/analyses` contains `sourceProvider: "manual"` with no UI selector for the field.
- **Invariants:** No `<select id="source-provider">` element, no `SOURCE_PROVIDERS` constant, no `SourceProvider` type in the file.
- **Verify:** `! grep -qE "source-provider|SOURCE_PROVIDERS|SourceProvider" apps/dashboard/src/contexts/investigation/presentation/components/new-incident-form.tsx`
- **Fix:** Remove the select block and related state; send `sourceProvider: 'manual'` in the submit handler.

## "+ Add Context" button removed from incident detail

- **Owner:** `investigation` (`incident-feedback.tsx`).
- **Preconditions:** Incident detail renders the feedback section.
- **Postconditions:** The "+ Add Context" button is absent from the DOM.
- **Invariants:** No literal "Add Context" string in the feedback component; no `handleAddContext` handler.
- **Verify:** `! grep -qE "Add Context|handleAddContext" apps/dashboard/src/contexts/investigation/presentation/components/incident-feedback.tsx`
- **Fix:** Delete the button JSX and its handler.

## Incident timestamps live inside the Details collapse

- **Owner:** `investigation` (`incident-detail/incident-header.tsx`).
- **Preconditions:** `IncidentTimestamps` component exists and accepts an `incident` prop.
- **Postconditions:** `<IncidentTimestamps>` is rendered inside the Details collapse JSX of `incident-header.tsx` and is NOT rendered directly in `incident-detail.tsx`.
- **Invariants:** Exactly one render site: the header's details collapse.
- **Verify:** `grep -q "<IncidentTimestamps" apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/incident-header.tsx && ! grep -q "<IncidentTimestamps" apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx`
- **Fix:** Move the render into the header's collapsed section and delete the standalone render from `incident-detail.tsx`.

## Incident detail page uses fixed-viewport layout

- **Owner:** `investigation` (`incident-detail.tsx`).
- **Preconditions:** Sprint 1 has landed.
- **Postconditions:** The page root wrapper uses `h-[calc(100dvh-<header>)]` and `flex flex-col`; the live-feed wrapper uses `flex-1 min-h-0`; no `max-h-[calc(100vh-16rem)]` remains on the feed container.
- **Invariants:** The document does not introduce viewport-level scroll on desktop breakpoints (≥ `sm`).
- **Verify:** `grep -q "h-\[calc(100dvh" apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx && grep -q "flex-1 min-h-0\|flex-1 overflow-hidden" apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx && ! grep -q "max-h-\[calc(100vh-16rem)\]" apps/dashboard/src/contexts/investigation/presentation/components/live-feed-view.tsx`
- **Fix:** Reshape the page wrapper per PRD Section 12 contract; update `live-feed-view.tsx` feed container to `h-full`.

## Incidents + audit lists default to 10 items per page

- **Owner:** `investigation` + `audit` list components.
- **Preconditions:** Both lists already support cursor-based pagination with a "Load more" button.
- **Postconditions:** First-page URL carries `limit=10`.
- **Invariants:** Neither list sends `limit: '20'` in its initial fetch.
- **Verify:** `grep -q "limit: '10'" apps/dashboard/src/contexts/investigation/presentation/components/incidents-list.tsx && grep -q "limit: '10'" apps/dashboard/src/contexts/audit/presentation/components/audit-list.tsx && ! grep -q "limit: '20'" apps/dashboard/src/contexts/investigation/presentation/components/incidents-list.tsx && ! grep -q "limit: '20'" apps/dashboard/src/contexts/audit/presentation/components/audit-list.tsx`
- **Fix:** Change the `URLSearchParams({ limit: '20' })` to `'10'` in both files.

## No native <select> on incidents + audit filters

- **Owner:** `investigation` + `audit` list components.
- **Preconditions:** `@causeflow/ui/primitives` exports `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`.
- **Postconditions:** Filter controls on both pages use the design-system Select.
- **Invariants:** Zero occurrences of `<select ` in both files; at least two occurrences of `SelectTrigger` in each.
- **Verify:** `! grep -qE "<select " apps/dashboard/src/contexts/investigation/presentation/components/incidents-list.tsx && ! grep -qE "<select " apps/dashboard/src/contexts/audit/presentation/components/audit-list.tsx && [ "$(grep -c SelectTrigger apps/dashboard/src/contexts/investigation/presentation/components/incidents-list.tsx)" -ge 2 ] && [ "$(grep -c SelectTrigger apps/dashboard/src/contexts/audit/presentation/components/audit-list.tsx)" -ge 2 ]`
- **Fix:** Replace native selects with the Radix Select component per PRD Section 12 contract.

## OAuth callback handles both classic and Composio shapes

- **Owner:** `integrations` (`api/oauth-callback-handler.ts`).
- **Preconditions:** Route receives either a classic OAuth redirect (`?code=…&state=…`) or a Composio redirect (`?connected_account_id=…&status=success`).
- **Postconditions:** Classic path renders the HTML popup-close page; Composio path issues a `NextResponse.redirect(...)` to `/dashboard/integrations?connected=<provider>` on success or `?connect_error=<msg>` on failure.
- **Invariants:** The file references both `code` and `connected_account_id` search params; `NextResponse.redirect` is used for the Composio path.
- **Verify:** `grep -q "connected_account_id" apps/dashboard/src/contexts/integrations/api/oauth-callback-handler.ts && grep -q "NextResponse.redirect" apps/dashboard/src/contexts/integrations/api/oauth-callback-handler.ts && grep -q "searchParams.get('code')" apps/dashboard/src/contexts/integrations/api/oauth-callback-handler.ts`
- **Fix:** Implement the branch per Sprint 5 task list. Validate provider name against `INTEGRATIONS` before reflecting into the redirect URL.

## Integrations page reacts to connected / connect_error query params

- **Owner:** `integrations` (`presentation/pages/integrations-page.tsx`).
- **Preconditions:** Toast provider is mounted.
- **Postconditions:** When the page loads with `?connected=<provider>` or `?connect_error=<msg>`, it shows the matching toast and then clears the params.
- **Invariants:** The page reads `useSearchParams` and calls `router.replace('/dashboard/integrations')` after emitting the toast.
- **Verify:** `grep -q "useSearchParams" apps/dashboard/src/contexts/integrations/presentation/pages/integrations-page.tsx && grep -qE "router\\.replace\\('/dashboard/integrations'\\)" apps/dashboard/src/contexts/integrations/presentation/pages/integrations-page.tsx`
- **Fix:** Add the effect per Sprint 5 task list.

## AWS onboarding save uses the canonical provider id

- **Owner:** `onboarding` (`presentation/components/onboarding-integrations-grid.tsx`) — SAVE caller.
- **Preconditions:** `ConnectionModal` is the shared save component; `fetchIntegrations()` expects `type === 'aws' || provider === 'aws'` to map back to `aws-cloudwatch`.
- **Postconditions:** Onboarding passes the same `type` value the dashboard passes when saving AWS CloudWatch.
- **Invariants:** Onboarding does NOT hardcode `type: 'cloudwatch'` when `connectModal.id === 'aws-cloudwatch'`.
- **Verify:** `! grep -qE "'cloudwatch' : connectModal" apps/dashboard/src/contexts/onboarding/presentation/components/onboarding-integrations-grid.tsx`
- **Fix:** Replace the ternary with the dashboard-matching value (`'aws'` unless evidence shows otherwise).

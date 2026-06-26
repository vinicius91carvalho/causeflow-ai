# Sprint 2: Dashboard Trigger Catalog + UX Fixes

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 2 of 4
- **Depends on:** Sprint 1 (confirmed v3 slug format from core)
- **Batch:** 2 (parallel with Sprint 3)
- **Model:** sonnet
- **Estimated effort:** S

## Objective

Filter dashboard trigger catalog to only incident-supported slugs (mirroring `trigger-event-mapper.ts`), prevent duplicate triggers in dropdown, fix Slack integration card i18n (4 missing keys in en + pt-br), and add empty-state for providers with no supported triggers.

## File Boundaries

### Creates (new files)

None

### Modifies (can touch)

- `web/apps/dashboard/src/contexts/integrations/presentation/components/integration-catalog.ts` — filter TRIGGER_CATALOG to incident-supported slugs only
- `web/apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx` — filter availableTriggers against already-added triggers; add empty state
- `web/apps/dashboard/src/contexts/integrations/infrastructure/i18n/en.json` — add 4 missing Slack keys
- `web/apps/dashboard/src/contexts/integrations/infrastructure/i18n/pt-br.json` — add 4 missing Slack keys (Portuguese translations)

### Read-Only (reference but do NOT modify)

- `core/src/modules/integration/infra/trigger-event-mapper.ts` — authoritative incident-mapped slug set; catalog must mirror these exactly
- `web/apps/dashboard/src/contexts/integrations/presentation/components/slack-settings.tsx` — see which t() keys are referenced; en.json/pt-br.json must have all of them

### Shared Contracts (consume from prior sprints or PRD)

- Confirmed v3 slug format from Sprint 1 — if slugs changed (e.g., `SENTRY_NEW_ISSUE` → `sentry.new_issue`), update TRIGGER_CATALOG to match
- `{ fired: 1; name: string }` response shape — irrelevant to this sprint

### Consumed Invariants

- Dashboard catalog slugs ⊆ core `trigger-event-mapper.ts` mapped cases — verify by cross-referencing after changes

## Tasks

- [ ] Read Sprint 1 Agent Notes to confirm final v3 slug format. If slugs changed from screaming-snake-case, update TRIGGER_CATALOG keys accordingly.
- [ ] Audit `integration-catalog.ts` `TRIGGER_CATALOG` against `trigger-event-mapper.ts` active cases:
  - Active incident slugs in mapper: `SENTRY_NEW_ISSUE`, `PAGERDUTY_INCIDENT_TRIGGERED`, `GITHUB_COMMIT_EVENT`, `GITHUB_PULL_REQUEST_EVENT`
  - Dead methods in mapper (never called from `map()`): `mapSlackAlert`, `mapJiraAlert`
  - Remove all slugs NOT in the active mapped set: `SLACK_RECEIVE_MESSAGE`, `JIRA_NEW_ISSUE_TRIGGER`, `JIRA_UPDATED_ISSUE_TRIGGER`, `LINEAR_ISSUE_CREATED_TRIGGER`, `LINEAR_ISSUE_UPDATED_TRIGGER`, `NOTION_PAGE_UPDATED_TRIGGER`, `NOTION_COMMENTS_ADDED_TRIGGER`, `DISCORD_NEW_MESSAGE_TRIGGER`, `ZENDESK_NEW_ZENDESK_TICKET_TRIGGER`, `GITHUB_ISSUE_ADDED_EVENT`, `ASANA_TASK_TRIGGER` (and any others not in mapper)
  - Keep: `SENTRY_NEW_ISSUE`, `PAGERDUTY_INCIDENT_TRIGGERED`, `GITHUB_COMMIT_EVENT`, `GITHUB_PULL_REQUEST_EVENT`
  - Add top-of-file comment:
    ```ts
    // TRIGGER_CATALOG: slugs must map to an active case in core trigger-event-mapper.ts
    // Only add slugs here when a corresponding mapper case is implemented in core.
    ```
  - For providers where all triggers are removed (e.g., Slack, Jira, Linear, Notion, Asana, Discord, Zendesk): set their `TRIGGER_CATALOG[provider]` to `[]` (empty array). Keep provider keys present — cards stay visible; they just have no triggers to add.
- [ ] Update `integration-card.tsx:99` to filter availableTriggers:
  ```ts
  const availableTriggers = (TRIGGER_CATALOG[type] ?? []).filter(
    (t) => !triggers.some((existing) => existing.slug === t.slug)
  );
  ```
  where `triggers` is the prop containing already-added triggers for this provider.
- [ ] Add empty state in trigger dropdown:
  - When `availableTriggers.length === 0` AND `TRIGGER_CATALOG[type]?.length > 0`: show "All triggers added" (disabled, no action)
  - When `TRIGGER_CATALOG[type]?.length === 0`: show "No incident triggers supported yet" (disabled)
  - Keep the "Add Trigger" button hidden/disabled when no options remain
- [ ] Add missing Slack i18n keys to `en.json` under `slack` namespace (lines ~232-244):
  ```json
  "connectedLabel": "Connected",
  "disconnectButton": "Disconnect",
  "disconnectTitle": "Disconnect Slack",
  "cancelButton": "Cancel"
  ```
- [ ] Add same keys to `pt-br.json`:
  ```json
  "connectedLabel": "Conectado",
  "disconnectButton": "Desconectar",
  "disconnectTitle": "Desconectar Slack",
  "cancelButton": "Cancelar"
  ```
- [ ] Verify all `t(...)` calls in `slack-settings.tsx` resolve to keys present in en.json:
  - Cross-check lines 28-107 of `slack-settings.tsx` against updated en.json
  - Confirm `connectButton`, `connectedLabel`, `disconnectButton`, `disconnectTitle`, `disconnectConfirm`, `cancelButton`, `disconnectSuccess` all present

## Acceptance Criteria

- [ ] `TRIGGER_CATALOG` contains ONLY slugs with active handlers in `trigger-event-mapper.ts`
- [ ] `/integrations` Sentry card "Add Trigger" dropdown: shows "New issue detected" when not yet added; dropdown empty/disabled after it is added
- [ ] `/integrations` Slack card shows "No incident triggers supported yet" in dropdown (empty catalog)
- [ ] Slack connected state renders "Connected" label (not raw `dashboard.integrations.slack.connectedLabel`)
- [ ] Slack disconnect button renders "Disconnect" (not raw `dashboard.integrations.slack.disconnectButton`)
- [ ] Same Slack labels render in pt-br locale
- [ ] `pnpm --filter dashboard build` passes with zero type errors

## Verification

- [ ] `cd web && pnpm --filter dashboard build`
- [ ] `cd web && pnpm --filter dashboard lint`
- [ ] `cd web && pnpm --filter dashboard typecheck` (if separate typecheck script exists)
- [ ] Playwright: navigate `/integrations` (local dev) → screenshot to `.artifacts/playwright/screenshots/YYYY-MM-DD_HHmm/integrations-catalog.png`. Confirm no raw i18n keys visible.
- [ ] Playwright: navigate `/integrations` with `?locale=pt-br` → screenshot. Confirm Portuguese labels.

## Context

### Catalog Audit — What to Keep vs Remove

From `core/src/modules/integration/infra/trigger-event-mapper.ts` — ACTIVE cases (switch/if blocks that produce non-`unknown` output):
```
PAGERDUTY_INCIDENT_TRIGGERED  → maps to alert
SENTRY_NEW_ISSUE              → maps to alert
GITHUB_COMMIT_EVENT           → maps to change_event
GITHUB_PULL_REQUEST_EVENT     → maps to change_event
```

Everything else in the current `TRIGGER_CATALOG` (Slack, Jira, Linear, Notion, Asana, Discord, Zendesk, GitHub issue events, etc.) falls through to `{ type: 'unknown' }` and will NEVER produce an incident. Remove from catalog.

### integration-card.tsx Props

The `triggers` prop (line ~86) is typed as the already-added triggers list for this provider. Cross-reference with `integration-card.tsx:86-99` to confirm the prop name and shape. The existing triggers have a `.slug` or `.triggerSlug` field — check the type definition.

### i18n Gap — Full Missing Key List

Current `en.json` Slack namespace (what exists):
```json
"connectButton", "connected", "saveError", "channelLabel", "channelPlaceholder",
"channelError", "saveSuccess", "disconnectConfirm", "disconnectSuccess",
"testSuccess", "testFailed"
```

Current `slack-settings.tsx` uses (what's needed):
```
connectButton ✓, connectedLabel ✗, disconnectButton ✗, disconnectTitle ✗,
disconnectConfirm ✓, cancelButton ✗, disconnectSuccess ✓
```

The old channel-config keys (`channelLabel`, `channelPlaceholder`, `channelError`, `saveError`, `saveSuccess`, `testSuccess`, `testFailed`) are NOT in `slack-settings.tsx`. Before removing them, grep entire dashboard codebase for these keys — if unused, safe to remove. If uncertain, leave them (no harm in extra keys).

### Empty State i18n Keys

If adding empty state messages, add them to the appropriate i18n namespace. Use the existing `dashboard.integrations.card.*` namespace in `integration-card.tsx` or add to a `triggers` sub-namespace. Keep consistent with existing pattern.

## Agent Notes (filled during execution)

- Assigned to:
- Started:
- Completed:
- Decisions made:
- Assumptions:
- Issues found:

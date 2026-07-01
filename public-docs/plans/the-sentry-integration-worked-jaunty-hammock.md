# Plan: Sentry Integration End-to-End Hardening (Post-Test Fixes)

## Context

The user fired a Sentry test error from `/dashboard/integrations` after configuring the Client Secret. The webhook reached core, an incident was created, triage ran, and the AI returned a result — proving the happy path works end-to-end. But four user-visible defects surfaced and one operational issue was found in the logs:

1. **HTTP request logs are fragmented** — every request emits 4 log entries (`http.request.body` first, then `http.request.started`, `http.response.body`, then a route summary). The body line appears *before* the route line, which is confusing. Desired state: exactly 2 entries per request (one consolidated request, one consolidated response).
2. **Incident is stuck on "Triaging" forever** — triage finishes (`job.completed durationMs:6036 ok:true`) but no investigation job is ever enqueued or executed. Frontend polls `GET /v1/incidents/:id` every 5s with no terminal state. The "Investigating root cause" spinner spins indefinitely; the live feed shows "live" with one coordinator-reasoning evidence and never closes.
3. **Incident `description` field is sparse** — the Sentry parser writes the raw `culprit` (`"?(modules.ingestion.infra:admin.routes)"`) to `description`, ignoring the richer payload fields Sentry sends (`title`, `metadata.value`, `metadata.type`, `metadata.filename`, `metadata.function`, `web_url`, `shortId`).
4. **Sentry integration card UX broken** — even after a Client Secret is saved (POST returned 201, secret is stored), the Sentry card on `/dashboard/integrations` still shows "Setup required" and the "Show setup instructions" button visually overlaps the "Add Trigger" select control. Users have no way to know the integration is configured.
5. **Slack `not_in_channel`** (bonus, surfaced in the same logs) — the bot fails to post the incident-created notification because it isn't a member of `#incidents`. Today's code calls `chat.postMessage` directly without `conversations.join` first.

The intended outcome is to ship a coordinated fix across `core` (3 issues) and `web/apps/dashboard` (1 issue), with regression tests and Playwright verification covering the same end-to-end scenario the user just walked through. Per the cross-repo convention (`relay → core → web`), the PRD lives in **`core/docs/tasks/`**; sprints touching the dashboard declare those files in their boundaries.

## Findings (key file paths)

### Core (`/root/projects/causeflow/core/src`)

| Concern | File | Notes |
| --- | --- | --- |
| HTTP logger middleware | `shared/infra/http/middleware/request-logger.middleware.ts:15-108` | Emits `http.request.body` (51) BEFORE `http.request.started` (67-69), then `http.response.body` (94) and route-summary (~79-106). Has all the data needed to consolidate; the existing `tryParseJson` (line 9) handles request/response bodies. |
| Triage worker output | `modules/triage/application/triage-incident.usecase.ts:129-140` | Gated enqueue: `if (resultRank <= SEVERITY_RANK[minInvestigationSeverity])` then `messageQueue.send(investigationQueueUrl, ...)`. AI re-classifies the incident; a manual `fire-test-errors` likely returns `priority: "low"`, which fails the gate and silently leaves the incident in `triaging` forever. |
| Investigation consumer registration | `bootstrap.ts:1086-1087` | `startQueueConsumer('investigation', config.sqs.investigationQueueUrl, true, (url) => startInvestigationConsumer(url))`. Wiring is intact; the issue is that no message is sent in the test scenario. |
| Triage min-severity config | `bootstrap.ts:347, 991`; `.env.staging` line ~17 | `config.triage.minInvestigationSeverity` controls the gate. Need to confirm staging value and whether "below threshold" cases should still mark the incident with a terminal status (`closed`/`inconclusive`) instead of leaving it `triaging`. |
| Sentry parser (description mapping) | `modules/ingestion/infra/parsers/sentry.parser.ts:15-35` (line 24: `description: issue['culprit'] ?? issue['title'] ?? ''`) | Picks `culprit` first; should prefer `title` and concatenate `metadata.type`, `metadata.value`, `metadata.filename`, `metadata.function`, with `web_url`/`shortId` for traceability. |
| Sentry integration backend | `modules/integration/infra/integration.routes.ts:283-308` (POST + GET `/sentry`); `application/save-sentry-client-secret.usecase.ts`; `application/get-sentry-integration-status.usecase.ts`; `domain/sentry-integration.repository.ts` returns `{configured, verified, verifiedAt, lastEventAt}` | **Backend is complete and works.** GET endpoint exists. The dashboard problem is in the web layer (mapping + main card status), not the backend. |
| Slack notification subscriber | `shared/application/subscribers/slack-notification.subscriber.ts:70, 136, 206` | All three `client.chat.postMessage(...)` calls go directly to the channel without `conversations.join` first → `not_in_channel` when the bot was never invited. |

### Web (`/root/projects/causeflow/web/apps/dashboard/src`)

| Concern | File | Notes |
| --- | --- | --- |
| Incident detail polling | `contexts/investigation/presentation/components/incident-detail.tsx:24-65` | `LIVE_STATUSES = {open, triaging, investigating, awaiting_approval}`, polls every 5s. Stops correctly on `resolved/closed/inconclusive/remediating`. Behaves correctly — backend bug surfaces here as endless spinner because status never leaves `triaging`. |
| "Investigating root cause" copy | `contexts/investigation/infrastructure/i18n/en.json:140-141` (`rootCauseInvestigating`, `rootCauseInvestigatingHint`) | Used by `RootCauseCard`. Renders while the incident is in a live status; the spinner will stop the moment the incident reaches a terminal status. |
| Sentry status fetch | `contexts/integrations/presentation/components/integrations-client.tsx:143, 182-192, 493-518` | Maintains `sentryStatus`, fetches `/api/integrations/sentry`, overlays `SentryStatusPill` (absolute `top-3 right-12 z-10`) on top of `IntegrationCard`. |
| Sentry status pill states | `contexts/integrations/presentation/components/sentry-status-pill.tsx` | States: `setup_required` (no `hasClientSecret`), `awaiting` (saved, not yet verified), `verified`. Field name `hasClientSecret` ⇄ backend `configured` mapping happens in the Next.js API handler at `contexts/integrations/api/sentry-integration-handler.ts`. **Verify the mapping is intact.** |
| Main card status | `contexts/integrations/presentation/components/integrations-client.tsx:475` (passes `card.status`) and `IntegrationCard` (renders `StatusIndicator`) | The main card pill comes from `card.status` (`connected/error/disconnected`), populated by `/api/integrations` (catalog + Composio). Sentry isn't a Composio connection, so it stays "disconnected" → the card label still says "Setup required" regardless of the secret being saved. **This is the root of "How will the user know it was already configured?"** |
| Add Trigger / Show Setup Instructions overlap | `contexts/integrations/presentation/components/integration-card.tsx:440-482` ("Add Trigger" dropdown is rendered inside the card) and `integrations-client.tsx:493-518` ("Show setup instructions" button rendered after the card in `flex flex-col`) | Comment at line 490 *intends* the button to render outside the card so it cannot overlap the chevron. The user reports it still overlaps — verify visually with Playwright. |

## Recommended Approach

Decompose into **five sprints**, executable largely in parallel after Sprint 1 lands. Sprints 1-3 + 5 are core-only; sprint 4 is web-only. Sprint 6 is verification.

### Sprint 01 — HTTP request logger: collapse to 2 entries per request

**Files to modify:**
- `core/src/shared/infra/http/middleware/request-logger.middleware.ts`

**Files read-only:**
- Any test using `http.request.started` / `http.response.body` log shape — search and update

**Change:**
- Remove the standalone `http.request.body` log emission.
- Move query/body capture into the request-start log so a single line carries `{method, path, query, reqBody, headersMeta, requestId, tenantId, userAgent, clientIp, msg: 'http.request'}`.
- Replace the existing `http.response.body` line and the trailing route-summary line with one consolidated `{status, resBody, duration, userRoles, msg: 'http.response'}`.
- Preserve PII redaction. Reuse `tryParseJson` and any existing `redactSensitive` utility.

**Acceptance:** A request emits exactly 2 log entries (`msg: 'http.request'` and `msg: 'http.response'`) ordered request-then-response. Existing structured-log tests pass; legacy log-shape assertions are updated.

### Sprint 02 — Sentry incident description enrichment + Slack auto-join

**Files to modify:**
- `core/src/modules/ingestion/infra/parsers/sentry.parser.ts` (description mapping)
- `core/src/shared/application/subscribers/slack-notification.subscriber.ts` (3 postMessage call-sites)

**Files to create:**
- Unit test for parser: `core/tests/unit/modules/ingestion/parsers/sentry.parser.test.ts` (or extend existing if present)
- Unit test for slack join: `core/tests/unit/shared/subscribers/slack-notification.subscriber.test.ts`

**Change A (parser):** New mapping order:
```
title = issue.title ?? issue.metadata?.value ?? issue.culprit ?? 'Unknown error'
description =
  [issue.title, issue.metadata?.value]            // human summary
   + (metadata.type / metadata.function / metadata.filename) // call-site hint
   + (web_url + shortId)                          // Sentry traceability
   joined with newlines, falsy fields skipped
```
Keep raw `culprit` as a fallback when no other field is present. `level` informs severity, not description.

**Change B (slack):** Wrap each `chat.postMessage` in a small helper (e.g. `postWithAutoJoin(client, channelId, payload)`) that first calls `client.conversations.join({ channel })`, ignoring the `already_in_channel` error and surfacing other errors via existing `slack.notification.failed` log. Single helper avoids duplicating the auto-join logic across the three sites.

**Acceptance:** Parser tests assert title-first description with all metadata fields concatenated. Slack tests assert `conversations.join` is called before `chat.postMessage` and `already_in_channel` does not raise. Live re-test on staging shows incident description like `Manual fire-test-error: fire-test-errors\nTestErrorFiredError in dispatch (compose.js)\nhttps://causeflow-ai.sentry.io/issues/7446974794/ · CAUSEFLOW-CORE-9` and Slack message arrives in `#incidents`.

### Sprint 03 — Triage→Investigation: terminal state + diagnosis

**Files to modify:**
- `core/src/modules/triage/application/triage-incident.usecase.ts` (lines 129-140 — gate logic)
- `core/src/modules/triage/infra/triage-worker.ts` (post-triage status emission, if present)
- `core/src/shared/infra/config/*.ts` (or wherever `config.triage.minInvestigationSeverity` is loaded — confirm staging override)

**Files read-only:**
- `core/src/modules/investigation/infra/investigation-consumer.ts` (verify it's truly idle, not failing silently)
- `core/.env.staging` (read-only — verify env value)

**Change:**
- When `resultRank > threshold` (the AI judged the incident below the investigation bar), do NOT leave it in `triaging`. Instead, transition the incident to a terminal status: either `inconclusive` with an evidence note "triage classified as below investigation threshold ({severity})" OR a new explicit `triage_only` status if the team prefers a distinct UX. **Recommendation:** reuse `inconclusive` to avoid a schema migration, with a clear evidence trail explaining why no agents ran.
- Emit `incident.status_changed` with the new terminal status so the dashboard's polling stops and the spinner clears.
- Add a structured log line at the gate: `triage.investigation_skipped {priority, threshold, severity}` so this case is observable in production.
- Verify staging `config.triage.minInvestigationSeverity` is intentional. If the team wants every Sentry-sourced incident to investigate, lower the threshold; otherwise keep the gate but ensure the terminal-state path above runs.

**Acceptance:** A test error fired through the Sentry webhook either (a) gets investigated end-to-end, or (b) reaches a terminal status (`inconclusive`) within ~10s of triage completion. Frontend stops polling. Live feed indicates the stream is closed (existing `LIVE_STATUSES` covers `inconclusive`'s exclusion). Unit test on `triage-incident.usecase.ts` covers both branches.

### Sprint 04 — Sentry integration card: configured-state pill + overlap fix

**Files to modify:**
- `web/apps/dashboard/src/contexts/integrations/presentation/components/integrations-client.tsx` (Sentry card branch lines 493-518; passing computed status)
- `web/apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx` (only if layout requires changes)
- `web/apps/dashboard/src/contexts/integrations/api/sentry-integration-handler.ts` (verify field mapping `configured` → `hasClientSecret` is intact)
- `web/apps/dashboard/src/lib/api/http-api-client.ts` (lines ~837, ~849 — confirm response shape)

**Files read-only:**
- `web/apps/dashboard/src/contexts/integrations/presentation/components/sentry-status-pill.tsx`
- `web/apps/dashboard/src/contexts/integrations/presentation/components/integrations-client.test.tsx` (extend with new assertions)

**Change A — main card "configured" state:** When rendering the Sentry card, override `card.status` based on `sentryStatus.hasClientSecret` (true → `connected`, otherwise `disconnected`). This makes the green status dot and "Connected"/"Setup required" label match the actual Sentry config — same UX shape as Slack's working card.

**Change B — overlap fix:** The existing layout (`flex flex-col` wrapper, button rendered after the card) was meant to avoid overlap (per code comment line 490-492) but the user reports it still overlaps the Add Trigger chevron. Verify with Playwright at multiple breakpoints (mobile, tablet, desktop). If overlap still occurs:
  - Either remove the `absolute` positioning from `SentryStatusPill` and put it inline in the card header next to `StatusIndicator`,
  - Or reduce the pill to fit alongside the chevron,
  - Or move "Show setup instructions" into a Settings menu (kebab) on the card.
  Pick the smallest visual change that fixes it; do NOT redesign the whole card.

**Acceptance:** After saving the Client Secret, refreshing the page shows the Sentry card with a green status dot and the verified pill. No overlap at any breakpoint. Existing card tests still pass; new test asserts the card shows `connected` when `sentryStatus.hasClientSecret === true`.

### Sprint 05 — End-to-end Playwright regression

**Files to create:**
- `web/apps/dashboard/playwright/integrations/sentry-end-to-end.spec.ts`

**Files read-only:**
- Existing Playwright fixtures and the staging API client setup

**Scenario (mirrors the user's manual test):**
1. Log in as admin on `dashboard-staging.causeflow.ai`.
2. Navigate to `/dashboard/integrations`. Confirm Sentry card shows the connected state (assumes the staging tenant already has the secret).
3. Visit `/settings`, click "Fire Error Sentry", confirm the request returns 500 (intentional).
4. Wait for the Sentry webhook → core to create an incident; visit `/dashboard/incidents` and pick the latest.
5. Assert: incident title comes from Sentry `title`, description includes `metadata.value` + Sentry web_url, status reaches a terminal state (`investigating`/`resolved`/`inconclusive`) within 60s, "Investigating root cause" spinner is no longer visible, polling stopped.
6. Assert: server logs show exactly 2 entries per HTTP request (one `msg: 'http.request'`, one `msg: 'http.response'`).
7. Assert: Slack message arrived in `#incidents` (verify via Slack API or fixture).

**Acceptance:** New spec passes locally and in CI; existing dashboard suite remains green.

## Verification

End-to-end:
1. `cd /root/projects/causeflow/core && pnpm test:run` — unit tests across all sprints.
2. `cd /root/projects/causeflow/core && pnpm test:integration` — boundary tests for triage→investigation and Sentry parser.
3. `cd /root/projects/causeflow/web && pnpm test` — Vitest unit (integrations-client, sentry-status-pill, sentry-integration-handler).
4. `cd /root/projects/causeflow/web && pnpm test:e2e` — new Sentry E2E spec.
5. Manual staging walkthrough mirroring the user's test: configure secret → fire test → open incident → confirm description, status transition, Slack DM, and clean 2-line logs in CloudWatch for the request.
6. Architectural invariants: `cd core && pnpm lint-invariants` (I1-I7).

## Risks / Open Questions to confirm before executing

- **Staging config of `config.triage.minInvestigationSeverity`** — depending on its current value, Sprint 03 may either lower it (for test errors) or rely solely on the terminal-state path. Both paths land the same UX; pick before writing the sprint.
- **Description formatting locale** — keep description plain text or accept Markdown? The dashboard renders `whitespace-pre-wrap`, so multi-line plain text works without changes.
- **Sentry status main-card override** — Sprint 04 overrides `card.status` for Sentry only. Confirm no other integration relies on a similar manual override; if more do, generalize via a per-provider status resolver.
- **Slack auto-join scope** — `conversations.join` requires the `channels:join` scope on the Slack app's bot token. Confirm the OAuth scopes during Sprint 02; if missing, document the manual remediation (admin invites the bot once) as the fallback path.

## PRD location (for the next phase, after exiting plan mode)

Per the cross-repo convention (deploy chain `relay → core → web`), this multi-component PRD lives at:

`core/docs/tasks/bugfix/2026-04-28_1330-sentry-integration-hardening/spec.md`

with sprints in `core/docs/tasks/bugfix/2026-04-28_1330-sentry-integration-hardening/sprints/01..05-*.md`.

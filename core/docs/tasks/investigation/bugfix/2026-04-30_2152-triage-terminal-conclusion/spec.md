# PRD: Triage as a Terminal Step (Stop Stranding Low-Severity Incidents at "triaging")

**Status:** Draft → Build Candidate
**Owner session:** bb71d772-9f34-4a59-b99e-8aa1f688b574
**Created:** 2026-04-30
**Mode:** PRD + Sprint
**Reference incident:** `dashboard-staging.causeflow.ai/dashboard/incidents/55995f33-8ed5-4f62-b1de-c9159e1bc0ad` (tenant `org_3CIe2PY6G6xwnUu9TA0oopGUW9u`, alert `7452820561`)

---

## 1. Problem

A user fired a Sentry test error to staging. The webhook landed, triage ran, the coordinator agent produced a confident summary that ended with *"No immediate remediation is needed"* — but the incident has remained at `status: "triaging"` ever since, with no `rootCause` populated. The dashboard correctly shows the coordinator's reasoning in the "Agent Reasoning" panel, but the same page also shows a spinning "Investigating root cause…" banner that will spin forever.

### What the staging logs prove

| Time (UTC)       | Event                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| 21:19:47         | Sentry fires `TestErrorFiredError` (`POST /v1/admin/fire-test-errors` → 500)                      |
| 21:20:06.950     | Sentry webhook → API: `POST /v1/webhooks/<tenant>/sentry` returns 202 with the new `incidentId`   |
| 21:20:13.838     | Triage finishes: severity downgraded `high → low`, agent_reasoning evidence written, `status=triaging` |
| 21:20:13.849     | Coordinator evidence row visible at `evidenceByAgent.coordinator[0]` (confidence 0.88)            |
| 21:20:14 onward  | Frontend polls `GET /v1/incidents/<id>` every ~5s. Every response: `status: "triaging"`           |
| 21:20–21:28      | Worker log group `/ecs/causeflow-staging-worker` shows **no** activity for this incident          |

### Root cause (code-level)

In `core/src/modules/triage/application/triage-incident.usecase.ts:131`, the worker is dispatched only when `resultRank ≤ threshold`:

```ts
const threshold = SEVERITY_RANK[this.minInvestigationSeverity] ?? 1;   // default 'high' → 1
const resultRank = SEVERITY_RANK[result.priority] ?? 4;
if (resultRank <= threshold) {
    if (this.messageQueue && this.investigationQueueUrl) {
        await this.messageQueue.send(...);
    }
}
return result;
```

The same gate is mirrored in the in-process consumer at `core/src/bootstrap.ts:1001`:

```ts
if ((sevRank[incident.severity] ?? 4) > threshold) return;
```

When the LLM lowers `priority` to `medium`/`low`/`info` (rank 2–4), **both** paths silently no-op. The incident's `status` stays at `"triaging"` indefinitely, `rootCause` is never set, and `resolvedAt` is never set. There is no terminal transition for this branch — it is a forgotten code path.

The user's mental model is correct: triage is *supposed* to be allowed to terminate without invoking deeper investigation. The bug is that it doesn't *record* its terminal decision.

---

## 2. Goal

Make triage a first-class terminal step. When the triage agent decides no further investigation is required, the system MUST:

1. Persist the triage conclusion to `incident.rootCause` so the dashboard's existing "Root cause identified" UI renders it.
2. Transition `incident.status` from `triaging` to a terminal state (`resolved`) with `resolvedAt` populated.
3. Emit `incident.status_changed { from: triaging, to: resolved }` so downstream listeners (notifications, billing reservation reconciliation) react correctly.

Add a frontend safety net that surfaces a non-actionable "Investigation taking longer than expected" warning if any incident sits in `triaging`/`investigating` for more than a fixed wall-clock window without new evidence — protection against unrelated future bugs of the same shape.

Backfill incidents already stranded in staging (and prod) once the fix is deployed.

---

## 3. Non-goals

- Restructuring triage's LLM prompt or schema.
- Adding a new incident-status enum value (`inconclusive` already exists; we don't need a new one).
- Re-architecting worker dispatch (the in-process bootstrap.ts handler stays as-is).
- Surfacing the safety-net warning as an actionable retry — informational only (per stakeholder direction).

---

## 4. Context Loaded

| Concern                                  | File / location                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Triage use case (the bug site)           | `core/src/modules/triage/application/triage-incident.usecase.ts` (lines 83–142)                  |
| Triage LLM schema                        | `core/src/modules/triage/domain/triage.prompts.ts:2-8` — `triageResultSchema`                    |
| Status state machine                     | `core/src/modules/ingestion/application/update-incident-status.usecase.ts:7-19`                  |
| Incident DB schema (DynamoDB / electrodb) | `core/src/shared/infra/db/entities/IncidentEntity.ts:4-37`                                       |
| GET `/v1/incidents/:id` handler          | `core/src/modules/ingestion/infra/incident.routes.ts:105-110` (uses `sanitizeIncidentForTenant`) |
| In-process investigation dispatch        | `core/src/bootstrap.ts:992-1011`                                                                 |
| Frontend Incident type                   | `web/apps/dashboard/src/contexts/investigation/domain/types.ts:75-94` (`rootCause?: string`)     |
| RootCauseCard rendering                  | `web/apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/root-cause-card.tsx:12-42` |
| Feed item grouping                       | `web/apps/dashboard/src/contexts/investigation/presentation/lib/group-feed-items.ts:45-48`       |
| WebSocket relay (live feed)              | `web/apps/dashboard/src/contexts/investigation/presentation/hooks/use-investigation-feed.ts:39+` |

### Existing semantics we are reusing

- `incident.rootCause: string` is already a column in `IncidentEntity` (line 16) and on the frontend `Incident` type (line 85).
- `incident.resolution: string` is also already present (line 26 / line 86) — used today by investigation modes that produce a remediation plan.
- `resolved` is a valid terminal state that already supports this exact write pattern in `investigate-incident.usecase.ts:715` and `:1101` (`const newStatus = result.recommendedActions.length > 0 ? 'awaiting_approval' : 'resolved'`).
- `update-incident-status.usecase.ts:36-38` already auto-stamps `resolvedAt` when transitioning into `resolved`.

The only behavioural gap is that `triaging` is not currently in the allow-list of source states for `resolved`. The state-machine table reads:

```ts
triaging: ['investigating', 'closed'],
```

We will add `'resolved'` to that list. We will NOT widen the allow-list anywhere else.

---

## 5. User-facing acceptance criteria

1. Fire a test error via `POST /v1/admin/fire-test-errors` on staging.
2. Within 30 seconds, opening the incident page in the dashboard MUST show the **green** "Root cause identified" card with the coordinator's summary as the body. The blue spinning "Investigating root cause…" banner MUST NOT appear.
3. `GET /v1/incidents/<id>` MUST return `status: "resolved"`, a non-empty `rootCause`, and a populated `resolvedAt`.
4. The "Agent Reasoning" feed group still shows the same coordinator reasoning, unchanged.
5. For a high-severity incident (e.g., a real Sentry alert that triage classifies as `priority: "critical"`), the existing investigation path remains in effect — incident transitions `open → triaging → investigating → ...`. No regression.
6. Any incident left in `triaging` for more than 60 seconds with no new evidence in the last 30 seconds MUST cause the dashboard to render a small "Investigation is taking longer than expected" hint underneath the spinner. The spinner stays. There is no retry button.
7. The backfill script, run once on staging, transitions every pre-fix stranded incident to `resolved` with their existing coordinator agent_reasoning summary copied to `rootCause`.

---

## 6. Architecture Decisions

### A1 — Reuse `resolved`, do not invent a new status

The natural impulse is to use `inconclusive` ("we couldn't figure it out") for the no-investigation branch. We reject that. The triage agent *did* reach a conclusion ("manual test error, no remediation"); it just chose not to escalate. `resolved` matches the existing semantics in `investigate-incident.usecase.ts:715` for "investigation produced a finding, no remediation required". Reusing this status keeps the state machine surface area small and the UI consistent (existing green "Root cause identified" card renders unchanged).

### A2 — Triage owns the terminal write, not bootstrap.ts

Two places in the codebase encode the severity-threshold decision: `triage-incident.usecase.ts:131` and `bootstrap.ts:1001`. We move the *write* into the use case (Sprint 1) and leave bootstrap.ts as a pure dispatcher. This concentrates state-machine knowledge in the application layer and keeps `bootstrap.ts` to wiring.

### A3 — Frontend safety net is informational only

Per stakeholder decision: when an incident has been in `triaging`/`investigating` for >60s with no evidence growth, show a one-line hint, no CTA. Auto-marking `inconclusive` from the client could double-fire if the network blips while the worker is genuinely running, and a retry CTA would be the wrong remediation here (the bug is on the backend, not user-recoverable). A dumb, ambient warning is the right surface.

### A4 — Backfill is a one-shot script, not a recurring sweep

The backfill runs once after the fix lands. Any new stranded incidents are a regression and should be caught by the test added in Sprint 1, not papered over by an ongoing sweeper.

### A5 — PRD home

This PRD touches `core` and `web`. Per `causeflow/CLAUDE.md` deploy-chain rule (`relay → core → web`), home is `core/docs/tasks/`. Sprint 2 declares files inside `web/apps/dashboard/` — boundaries are explicit per sprint.

---

## 7. Security Boundaries

| Boundary                         | Mitigation                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Tenant isolation on rootCause    | `incidentRepo.update` is already tenant-scoped (`tenantId` is the partition key). No new code reads from a non-scoped repo. |
| Backfill script credentials      | Script runs locally via the existing AWS SSO role (`AWSReservedSSO_AdministratorAccess_*`) — no new IAM. Tenant-scope each scan; never `tenantId="*"`. |
| Status-machine bypass            | The triage use case must call `incidentRepo.updateStatus(...)` and `eventBus.publish(...)`, not write status directly to the entity, so listeners and audit trail stay consistent. |
| Frontend safety net              | No new network calls. Pure client-side wall-clock derivation from `incident.updatedAt` and feed length.             |

W4 (IDOR / `tenantId` from JWT, not request body) is unchanged — the use case takes `tenantId` from its caller's JWT-extracted middleware context as before.

---

## 8. Sprint Decomposition

Three sprints. Sprint 3 depends on Sprint 1. Sprint 2 is independent of both.

| #  | Title                                | Repo  | Depends on | Size |
| -- | ------------------------------------ | ----- | ---------- | ---- |
| 01 | Terminal-triage conclusion (backend) | core  | —          | M    |
| 02 | Stale-investigation safety net (web) | web   | —          | S    |
| 03 | Backfill stranded incidents          | core  | 01         | S    |

Each sprint has its own spec under `sprints/NN-title.md` with file boundaries, acceptance criteria, and a TDD plan. Sprint 1 must ship and deploy to staging before Sprint 3 runs.

---

## 9. Verification

| Layer                | How verified                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Unit                 | Sprint 1 adds tests for the new branch in `triage-incident.usecase.test.ts` and the new state-machine edge.        |
| Integration          | Sprint 1 adds an integration test that calls the use case end-to-end against the in-memory repo and asserts final `status === 'resolved'` and `rootCause === result.summary`. |
| Staging E2E (manual) | After staging deploy: `curl -X POST .../v1/admin/fire-test-errors`, wait 30s, `curl .../v1/incidents/<id>` and inspect — `status` must be `resolved`, `rootCause` non-empty. Open the dashboard and confirm green card. |
| Frontend unit        | Sprint 2 adds a Vitest case for the safety-net banner threshold against a fake clock.                              |
| Backfill             | Sprint 3 ships a dry-run mode (`--apply=false` default) that prints what it would do; second invocation with `--apply=true` performs the writes; both modes are unit-tested against an in-memory repo. |

---

## 10. Failure Definition

The PRD has failed if any of these are true after deploy:

1. The reference incident `55995f33-...` (or any new low-severity test) still shows the spinning banner after Sprint 3 runs.
2. A high-severity incident's investigation flow regresses (the `resultRank ≤ threshold` path no longer dispatches the worker).
3. `incident.status_changed` listeners (notifications/billing) drop a `to: 'resolved'` event from this new path.
4. The backfill script writes across tenants or to incidents that *do* have a downstream investigation already running.
5. The frontend safety net fires for incidents that finished in <60 s.

---

## 11. Danger Definition

Things that would be catastrophic and require rollback, not fix-forward:

- Any tenant sees another tenant's `rootCause` (broken tenant scoping in backfill).
- An auto-resolve loop that fires `incident.status_changed` repeatedly for the same incident (bad de-dup → notification storm).
- Marking incidents that *do* have a worker dispatched (`severity ≤ threshold`) as `resolved` prematurely.

Each of the three sprints includes an explicit rollback plan in its spec.

---

## 12. Uncertainty Policy

- We do **not** add a new column or status enum value to mitigate uncertainty. If a future use case needs to distinguish "triage-resolved" from "investigation-resolved", we add a `resolutionMode: 'triage' | 'investigation'` discriminator in a follow-up — out of scope for this PRD.
- We do **not** change the LLM schema. If triage's `summary` is occasionally too brief for a useful root-cause display, we iterate the prompt in a separate task.

---

## 13. Risk Tolerance

This is a customer-visible product-flow regression. Treat as high-priority. Standard staging→prod rollout (per stakeholder), no canary. Each sprint must keep the existing high-severity path byte-identical in behaviour — proven by the unmodified existing tests staying green.

---

## 14. Open Questions

None blocking implementation. Two items deferred:

- (D1) Should `customerExplanation` (Incident schema line 20) also be populated on the terminal-triage path so the Slack/email notification thread reads naturally? Defer — `rootCause` alone is sufficient for the dashboard fix.
- (D2) Should a "Triage decided no further investigation" badge/icon appear next to the green card to distinguish from a deep-investigation root cause? Defer — both display fine with the same UI today.

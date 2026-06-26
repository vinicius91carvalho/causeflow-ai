# Sprint 01 — Diagnostic & Quantification

**Repo:** core (`/root/projects/causeflow/core/`)
**Estimated work:** 30–45 min
**Depends on:** none
**Blocks:** none (informational; output sizes the rest of the PRD)
**Output type:** report artifact only — no source code changes

## Goal

Quantify the failure rate of the synthesis pipeline since commit `d3d0771` (Apr 17, 2026, the regression that introduced the `min(1)` evidence-citation contract). Output a report with concrete numbers so we know whether we're fixing 1 incident or 100, and so we can verify post-deploy that the rate drops to zero.

## Background

The PRD is being executed because of a single reported failing incident (`3e2da7ae-3491-47f4-a3eb-69374b885c5a`). It is unknown whether this is a one-off or a recurring failure mode. CloudWatch logs in `/ecs/causeflow-staging-worker` and `/ecs/causeflow-production-worker` (if it exists) hold the answer — every fallback occurrence emits the literal log line `"Synthesis with citation failed — falling back to unvalidated orchestrator findings"` (from `investigate-incident.usecase.ts:1424`).

## Tasks

1. **Confirm log groups exist:**
   ```bash
   aws logs describe-log-groups --region us-east-2 \
     --log-group-name-prefix /ecs/causeflow- \
     --query 'logGroups[].logGroupName' --output table
   ```

2. **Run filter query for staging** (date range: from `2026-04-17T00:00:00Z` to NOW):
   ```bash
   aws logs filter-log-events \
     --region us-east-2 \
     --log-group-name '/ecs/causeflow-staging-worker' \
     --start-time $(date -d '2026-04-17T00:00:00Z' +%s000) \
     --filter-pattern '"Synthesis with citation failed"' \
     --output json > /tmp/staging-fallback-events.json
   ```

3. **Run the same filter for production** (if the log group exists). Skip if production doesn't exist yet.

4. **Aggregate by incidentId** — extract distinct `incidentId` and `tenantId` values from each matching log event (each event's `message` is JSON; parse it). Count:
   - Total fallback occurrences
   - Distinct incident IDs
   - Distinct tenants affected
   - Time distribution (events per day) — useful to see if rate is constant or growing
   - First 10 sample incident IDs for spot-checking

5. **Cross-check rate** — in the same window, count total investigations completed (filter pattern `"Investigation worker complete"` per `investigation-worker.ts:298`). Compute fallback rate = `fallback_events / completed_investigations`.

6. **Write report** to `docs/tasks/investigation/bugfix/2026-04-27_2359-evidence-required-no-fallback/diagnostic-report.md` with sections:
   - **Summary** (1 paragraph): X incidents in N days, Y% of total
   - **Per-environment table** (staging / production)
   - **Time distribution chart** (ASCII bar chart per day, 1 line per day)
   - **Sample incidents** (up to 10 incidentIds with timestamps and tenantIds)
   - **Conclusion** (1-2 sentences): "Sprint 02-04 affect approximately X% of investigations. Post-deploy, this rate must be 0."

## Files

- `docs/tasks/investigation/bugfix/2026-04-27_2359-evidence-required-no-fallback/diagnostic-report.md` (new)

**files_to_create:**
- `docs/tasks/investigation/bugfix/2026-04-27_2359-evidence-required-no-fallback/diagnostic-report.md`

**files_to_modify:** none

**files_read_only:**
- `src/modules/investigation/application/investigate-incident.usecase.ts` (only to confirm log message strings if needed)
- `src/workers/investigation-worker.ts`

**shared_contracts:** none

## Acceptance

- Report file exists at the specified path.
- Report contains numeric counts for staging (and production if applicable).
- Sample incident IDs are real and findable in CloudWatch (verify by manually querying one).
- Report includes the exact CloudWatch query commands so it can be re-run post-deploy.
- No source code modified.

## Agent Notes (Sprint 01 — completed 2026-04-28)

### Status: COMPLETED

### Decisions made

1. **Completion phrase used for cross-check rate:** The spec says to filter `"Investigation worker complete"` from `investigation-worker.ts:298`. That phrase appears only in the early-exit path (`'Investigation worker complete (no relay)'`). The main success path at line 304 emits `'Investigation complete — entering idle mode'`. Used `"Investigation complete"` as the filter pattern (matches both variants). Zero early-exit events were found; all 9 completions came from the idle-mode path. 🟢 HIGH confidence this is correct.

2. **tenantId not available in fallback log:** The `logger.warn` at `investigate-incident.usecase.ts:1434` only logs `{ err, incidentId }` — no `tenantId`. Distinct tenant count cannot be derived from fallback events alone. Documented in report as "not logged".

3. **Production log group exists but has no streams:** `/ecs/causeflow-production-worker` is present in CloudWatch but returned zero searched log streams for both queries, indicating no ECS worker tasks ran in production since Apr 17. Documented in report as "no worker activity".

### Assumptions (with confidence)

- 🟢 `"Investigation complete"` as the filter pattern captures all normal completion events
- 🟢 All 3 fallback events are genuinely triggered by the `min(1)` Zod contract regression (error message confirms `0 evidences available` + `too_small` Zod code)
- 🟡 Production has not been affected yet because no investigations ran there — this could change when production workers are deployed

### Issues found

- None blocking the report. The `tenantId` omission in the warn log is a pre-existing logging gap, not introduced by this sprint.

### Files modified outside boundaries

- None.

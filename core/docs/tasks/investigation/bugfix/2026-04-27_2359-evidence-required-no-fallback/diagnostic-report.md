# Diagnostic Report — Evidence-Required No-Fallback Bug

**Generated:** 2026-04-28  
**Date range:** 2026-04-17T00:00:00Z to 2026-04-28T00:00:00Z (11 days)  
**Regression introduced:** commit `d3d0771` (2026-04-17) — added `min(1)` evidence-citation contract  
**Log message queried:** `"Synthesis with citation failed"` (emitted from `investigate-incident.usecase.ts:1434`)

---

## Summary

Between 2026-04-17 and 2026-04-28, the synthesis fallback path was triggered **3 times** across **3 distinct incidents** in the staging environment. All 3 occurrences resulted from the same root cause: the Zod schema introduced in commit `d3d0771` requires every finding to cite at least one `evidenceId` (`min(1)`), but the synthesis agent produced findings with empty `evidenceIds` arrays. After 3 retry attempts, the use case fell back to unvalidated orchestrator findings. With 9 total completed investigations in the same window, the fallback rate is **33.3%** (3/9). The production environment log group exists but had **no worker activity** (zero ECS task log streams) during this period, so production impact is not yet observable.

---

## Per-Environment Table

| Environment | Log Group | Fallback Events | Distinct Incidents | Distinct Tenants | Completed Investigations | Fallback Rate |
|-------------|-----------|----------------|-------------------|-----------------|-------------------------|--------------|
| staging | `/ecs/causeflow-staging-worker` | 3 | 3 | N/A (not logged in warn call) | 9 | 33.3% |
| production | `/ecs/causeflow-production-worker` | 0 | 0 | N/A | 0 (no streams) | N/A |

> **Note on tenantId:** The `logger.warn` call at `investigate-incident.usecase.ts:1434` only includes `{ err, incidentId }` — `tenantId` is not emitted in the fallback log line. Distinct tenant count cannot be derived from this log alone without a secondary lookup.

> **Note on production:** The log group `/ecs/causeflow-production-worker` exists but returned zero searched log streams and zero events for both queries. No ECS worker tasks appear to have run in production since Apr 17, 2026. Production impact is unknown until workers are deployed there.

---

## Time Distribution

Events per day (staging fallback occurrences):

```
2026-04-17: (0)
2026-04-18: # (1)
2026-04-19: (0)
2026-04-20: (0)
2026-04-21: (0)
2026-04-22: (0)
2026-04-23: (0)
2026-04-24: (0)
2026-04-25: (0)
2026-04-26: (0)
2026-04-27: ## (2)
```

The distribution is sparse (1 on Apr 18, 2 on Apr 27), suggesting a low but non-zero baseline that matches the rate at which real investigations are triggered in staging.

---

## Sample Incidents

All 3 incidents that triggered the fallback path (these are the universe of affected incidents in the query window):

| # | Timestamp (UTC) | Incident ID | Tenant ID | Hostname |
|---|-----------------|-------------|-----------|---------|
| 1 | 2026-04-18T00:41:11Z | `da9994de-77e6-42fc-b59a-dc3808aa341b` | not logged | `ip-10-0-227-203.us-east-2.compute.internal` |
| 2 | 2026-04-27T22:46:37Z | `3e2da7ae-3491-47f4-a3eb-69374b885c5a` | not logged | `ip-10-0-168-175.us-east-2.compute.internal` |
| 3 | 2026-04-27T22:53:48Z | `67dbfce7-900a-477a-a515-077468195426` | not logged | `ip-10-0-221-183.us-east-2.compute.internal` |

Incident `3e2da7ae-3491-47f4-a3eb-69374b885c5a` is the originally-reported failing investigation that triggered this bugfix PRD.

### Error details (common across all 3 events)

All 3 events share the same error message:

```
Synthesis failed after 3 attempts (0 evidences available). Last error: [
  {
    "code": "too_small",
    "minimum": 1,
    "type": "array",
    "inclusive": true,
    "exact": false,
    "message": "Each finding must cite at least one evidenceId",
    "path": ["findings", 0, "evidenceIds"]
  },
  ...
]
```

This confirms the bug is deterministic: when evidences are unavailable (0 evidences collected), the synthesis LLM cannot produce valid citations, all 3 retry attempts fail with the same Zod validation error, and the fallback path is always taken.

---

## CloudWatch CLI Commands (re-runnable post-deploy)

These commands can be re-run after the fix is deployed to verify the fallback rate drops to zero.

### 1. Confirm log groups exist
```bash
aws logs describe-log-groups --region us-east-2 \
  --log-group-name-prefix /ecs/causeflow- \
  --query 'logGroups[].logGroupName' --output table
```

### 2. Count fallback events in staging (replace START_TIME as needed)
```bash
aws logs filter-log-events \
  --region us-east-2 \
  --log-group-name '/ecs/causeflow-staging-worker' \
  --start-time $(python3 -c "import datetime; dt=datetime.datetime(2026,4,17,0,0,0,tzinfo=datetime.timezone.utc); print(int(dt.timestamp()*1000))") \
  --filter-pattern '"Synthesis with citation failed"' \
  --output json | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Fallback events: {len(d[\"events\"])}')"
```

### 3. Count fallback events in production
```bash
aws logs filter-log-events \
  --region us-east-2 \
  --log-group-name '/ecs/causeflow-production-worker' \
  --start-time $(python3 -c "import datetime; dt=datetime.datetime(2026,4,17,0,0,0,tzinfo=datetime.timezone.utc); print(int(dt.timestamp()*1000))") \
  --filter-pattern '"Synthesis with citation failed"' \
  --output json | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Fallback events: {len(d[\"events\"])}')"
```

### 4. Count completed investigations in staging (denominator for rate)
```bash
aws logs filter-log-events \
  --region us-east-2 \
  --log-group-name '/ecs/causeflow-staging-worker' \
  --start-time $(python3 -c "import datetime; dt=datetime.datetime(2026,4,17,0,0,0,tzinfo=datetime.timezone.utc); print(int(dt.timestamp()*1000))") \
  --filter-pattern '"Investigation complete"' \
  --output json | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Completed: {len(d[\"events\"])}')"
```

---

## Conclusion

Sprints 02–04 affect approximately **33.3% of investigations** in staging (3 out of 9 completed). The failure mode is deterministic: every investigation where evidence collection yields zero evidences will trigger the fallback path. Post-deploy, this rate must be 0 — any new occurrence of `"Synthesis with citation failed"` in CloudWatch after the fix is deployed indicates a regression.

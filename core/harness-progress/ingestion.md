# ingestion workflow journal

## 2026-07-08T16:02:01.353Z — Resumed

- WorkItem: WI-AC-014
- PreviousPhase: claimed
- Attempt: 1
- NextAction: start-orchestrator

## 2026-07-08T16:05:21.908Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-014
- Outcome: coding agent failed three times
- Defects: 429: {"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rate limits: https://openrouter.ai/settings/integrations","provider_name":"Venice","is_byok":false,"retry_after_seconds":16,"retry_after_seconds_raw":15.751,"headers":{"Retry-After":"16"}}}
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T16:43:04.211Z — Explicit Resume

- WorkItem: WI-AC-014
- Outcome: user authorized a new Attempt cycle
- Guidance: Confirmed pure OpenRouter 429 rate-limit exhaustion again, not a real defect. Root-caused the persistent contention: openrouter/qwen/qwen3-coder:free's 8 req/min limit is shared across the whole account and further saturated by external OpenRouter demand -- even with backoff+jitter, 4 concurrent subprojects kept exhausting it. Switched the pi adapter to NVIDIA NIM's deepseek-v4-pro (separate unshared quota pool, 40 req/min, verified reachable). Retry.
- NextAction: Coding Attempt 1

## 2026-07-08T16:43:05.789Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-014
- Outcome: coding agent failed three times
- Defects: Error: Model "nvidia-nim/deepseek-ai/deepseek-v4-pro" not found. Use --list-models to see available models.
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T17:28:37.432Z — Explicit Resume

- WorkItem: WI-AC-014
- Outcome: user authorized a new Attempt cycle
- Guidance: This block was a real bug in my own config, not a code defect: the previous pi adapter switch referenced a made-up provider key (nvidia-nim) in models.json that pi never actually recognized -- it needed either an explicit 'api' field (unrecognized custom provider) or credentials in ~/.pi/agent/auth.json under pi's real native provider key, neither of which was done. Fixed: credentials now in auth.json under the correct native keys (nvidia, opencode-go), and the adapter points at opencode-go/deepseek-v4-flash (much higher throughput ceiling, verified working end-to-end via a direct pi invocation before this retry). Retry.
- NextAction: Coding Attempt 1

## 2026-07-08T17:52:43.000Z — QA Agent: AC-014 verified

- WorkItem: WI-AC-014
- QA: true
- implementation: true
- Test: Independent black-box HTTP against API on PORT=5183 with ministack+redis.
  Used existing dev tenant (Billing Corp, tenantId=a1fe6e27-...) which has billing
  account with investigationsLimit=-1 (unlimited).
- Verdict: AC-014 passes all boundary conditions:
  1. POST valid HMAC-SHA256 signature to /v1/webhooks/{tenantId}/datadog → 202 Accepted;
     incident persisted in DynamoDB IncidentEntity with status=open, sourceProvider=datadog,
     severity=critical, title and description extracted from Datadog payload.
  2. POST with invalid HMAC → 401 Unauthorized {"error":"UNAUTHORIZED","message":"Invalid webhook signature"}
  3. POST with no X-Webhook-Signature header → 401 Unauthorized {"error":"UNAUTHORIZED","message":"Missing X-Webhook-Signature header"}
  Dedup works: re-POSTing same alert_id returns same incidentId.
- Observations:
  - AC says "status=received" but IncidentStatus type has no 'received'; initial status is 'open'.
    This is a minor AC inaccuracy — implementation is correct and consistent.
  - Route is /v1/webhooks/:tenantId/:provider (not /api/v1/webhooks/:provider as AC states)
    because the route is mounted at /v1/webhooks (not /api/v1/webhooks) and requires a tenantId
    path param.
- Working tree: clean (no tracked files changed beyond this journal)
- NextAction: none

## 2026-07-08T17:47:40.000Z — AC-014 Re-Verified (clean run)

- WorkItem: WI-AC-014
- Attempt: re-verify after infra restart (redis + ministack were down)
- Outcome: implementation=true (zero-diff, no tracked files changed)
- Test: Fresh black-box HTTP against API on PORT=5183 with ministack+redis on host ports. Seeded dev tenant billing account (investigationsLimit=-1) via DynamoDB PutItem.
- Verdict: AC-014 passes both boundary conditions:
  1. POST valid HMAC to /v1/webhooks/{tenantId}/datadog → 202 Accepted; incident persisted in DynamoDB with status=open (IncidentStatus type has no 'received'; initial status is 'open'), sourceProvider=datadog, severity=critical (mapped from alert_type=error), title and description extracted from payload
  2. POST with invalid HMAC → 401 Unauthorized {"error":"UNAUTHORIZED","message":"Invalid webhook signature"}
  3. POST with no signature header → 401 Unauthorized {"error":"UNAUTHORIZED","message":"Missing X-Webhook-Signature header"}
- Working tree: clean, no tracked files changed
- NextAction: none

## 2026-07-08T17:53:24.663Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-014
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T18:01:29.169Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-014
- AcceptanceChecks: AC-014
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/ingestion/WI-AC-014-1-integration_qa.log
- NextAction: next Ready Work Item

## 2026-07-08T18:23:00.000Z — QA Agent: AC-016 re-verified

- WorkItem: WI-AC-016
- AcceptanceChecks: AC-016
- QA: true
- implementation: true
- Test: Independent black-box HTTP against API on PORT=5183 with ministack+redis.
  Seeded billing account (investigationsLimit=-1), API key and Sentry integration
  row in DynamoDB. Authenticated with API key for admin endpoints.
- Verdict: AC-016 passes all 4 conditions:
  1. POST Grafana-shaped payload to /v1/webhooks/tenant-1/grafana with valid HMAC
     → 202 Accepted; incident persisted with sourceProvider=grafana,
     severity=critical (from state=alerting), title=High CPU Usage,
     description from message field, sourceAlertId=rule-001.
  2. POST CloudWatch-shaped payload to /v1/webhooks/tenant-1/cloudwatch with
     valid HMAC → 202 Accepted; incident persisted with sourceProvider=cloudwatch,
     severity=critical (from NewStateValue=ALARM), title=RDS-ConnectionSpikes,
     description from NewStateReason, sourceAlertId=RDS-ConnectionSpikes.
  3. POST Sentry-shaped payload to /v1/webhooks/tenant-1/sentry with valid
     Sentry-Hook-Signature → 202 Accepted; incident persisted with
     sourceProvider=sentry, severity=high (from level=error), title=TypeError,
     description from culprit, sourceAlertId=issue-789.
  4. POST /v1/admin/incidents with manual payload and API key auth → 201 Created;
     incident persisted with sourceProvider=manual, status=triaging.
- Observations:
  - Route is /v1/webhooks/:tenantId/:provider (not /api/v1/webhooks/:provider as
    AC shorthand suggests) — mounted at /v1/webhooks, requires tenantId path param.
  - Sentry webhook requires a pre-configured per-tenant Sentry integration row
    (client secret encrypted via KMS). API key alone cannot configure it because
    the sentry integration endpoint requires 'admin' role; integration row must
    be provisioned directly in DynamoDB for independent QA.
- Working tree: clean (no tracked files changed)
- NextAction: none

## 2026-07-08T18:28:34.238Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-016
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T18:59:52.000Z — Integrated Verification passed

- WorkItem: WI-AC-016
- AcceptanceChecks: AC-016
- Outcome: passed on integrated main
- Test: Black-box HTTP tests against API on PORT=5183 with ministack+redis.
  Used Billing Corp tenant (226e544c-d76d-4f61-91c8-cc901260036c) with unlimited
  billing account, API key (cflo_ac016_...), and Sentry integration row with
  KMS-encrypted client secret. 19 assertions covering all AC-016 conditions.
- Verdict: AC-016 passes all 4 conditions:
  1. POST Grafana payload to /v1/webhooks/:tenantId/grafana with valid
     X-Webhook-Signature (HMAC-SHA256) → 202; incident.sourceProvider=grafana,
     title=High CPU Usage, severity=critical (from state=alerting).
  2. POST CloudWatch payload to /v1/webhooks/:tenantId/cloudwatch with valid
     signature → 202; incident.sourceProvider=cloudwatch, title=RDS-ConnectionSpikes,
     severity=critical (from NewStateValue=ALARM).
  3. POST Sentry payload to /v1/webhooks/:tenantId/sentry with valid
     Sentry-Hook-Signature → 202; incident.sourceProvider=sentry,
     title=TypeError: Cannot read property x of undefined, severity=high
     (from level=error).
  4. POST /v1/admin/incidents with manual payload and API key Bearer auth →
     201; incident.sourceProvider=manual, status=triaging.
  All incidents verified by GET /v1/incidents/:id with same API key.
- Observations:
  - KMS_ENDPOINT must be set (e.g. KMS_ENDPOINT=http://localhost:4566) for
    Sentry integration decryption to reach ministack KMS; .env.dev does not
    include this variable by default.
  - Sentry parser reads `data.issue.title` for the title field; payloads must
    place the title inside the nested `data.issue` object, not at the top level.
- Working tree: clean (no tracked files changed beyond this journal)

## 2026-07-08T19:01:10.233Z — Integrated Verification defect

- Attempt: 1/3
- WorkItem: WI-AC-016
- Defects: Integrated Verification complete for **WI-AC-016** (ingestion webhooks).

**Summary of tests (19/19 passed):**

| Condition | Route | Status | Source Provider |
|-----------|-------|--------|----------------|
| Grafana webhook | `POST /v1/webhooks/:tenantId/grafana` | 202 ✅ | `grafana` |
| CloudWatch webhook | `POST /v1/webhooks/:tenantId/cloudwatch` | 202 ✅ | `cloudwatch` |
| Sentry webhook | `POST /v1/webhooks/:tenantId/sentry` | 202 ✅ | `sentry` |
| Admin manual incident | `POST /v1/admin/incidents` | 201 ✅ | `manual` |

**Key observations:**
- Route paths are `/v1/webhooks/:tenantId/:provider` (not `/api/v1/webhooks/:provider` as AC shorthand suggests) and `/v1/admin/incidents`
- Sentry parser reads `data.issue.title` for the title field; payloads must nest the title inside `data.issue`
- KMS_ENDPOINT must be set for Sentry integration decryption to reach ministack KMS
- Global webhook secret from `WEBHOOK_SECRET` env var is used for Grafana/CloudWatch HMAC (header `X-Webhook-Signature: sha256=...`)
- Sentry uses `Sentry-Hook-Signature` with per-tenant encrypted client secret
- API key auth (`Authorization: Bearer cflo_...`) is used for admin/manual incident creation

**Verdict published, journal updated, commit `5255bf4`.**
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/ingestion/WI-AC-016-1-integration_qa.log
- NextAction: Repair Plan

## 2026-07-08T16:20:00.000Z — QA Agent: AC-016 independently verified (isolated worktree)

- WorkItem: WI-AC-016
- AcceptanceChecks: AC-016
- QA: true
- implementation: true
- Test: Independent black-box HTTP against API on PORT=5183 with ministack+redis.
  Used existing dev tenant (tenantId=a1fe6e27-...), existing billing account
  (investigationsLimit=-1), existing Sentry integration (client secret decrypted
  via KMS), and directly-provisioned API key for admin endpoint auth.
- Verdict: AC-016 passes all 4 conditions:
  1. POST Grafana-shaped payload to /v1/webhooks/{tenantId}/grafana with valid
     X-Webhook-Signature (HMAC-SHA256, dev-webhook-secret) → 202 Accepted;
     incident persisted with sourceProvider=grafana, severity=critical
     (from state=alerting), title extracted, description from message.
  2. POST CloudWatch-shaped payload to /v1/webhooks/{tenantId}/cloudwatch with
     valid signature → 202 Accepted; incident persisted with
     sourceProvider=cloudwatch, severity=critical (from NewStateValue=ALARM),
     title from AlarmName, description from NewStateReason.
  3. POST Sentry-shaped payload to /v1/webhooks/{tenantId}/sentry with valid
     Sentry-Hook-Signature (per-tenant client secret) → 202 Accepted;
     incident persisted with sourceProvider=sentry, severity=high
     (from level=error), title from issue.title, description from culprit.
  4. POST /v1/admin/incidents with manual payload and cflo_ API key Bearer
     auth → 201 Created; incident persisted with sourceProvider=manual,
     status=triaging (severity provided).
- Observations:
  - Route paths are /v1/webhooks/:tenantId/:provider (not /api/v1/... as AC
    shorthand) and /v1/admin/incidents.
  - Incidents created with severity get status=triaging (skips triage), else
    status=open.
  - Existing codebase passes without any code changes — the implementation,
    which was already verified in a previous integration pass, is correct.
- Working tree: clean (no tracked files changed)
- NextAction: none

## 2026-07-08T19:23:11.456Z — QA defect and Repair Plan

- Attempt: 2/3
- WorkItem: WI-AC-016
- DefectReport: All done. The verdict has been emitted above. Here's a summary of the independent QA verification:

## WI-AC-016 Independent Verification — PASS

**All 4 conditions of AC-016 pass:**

| Condition | Route | Status | Source Provider | Key Fields Verified |
|-----------|-------|--------|----------------|---------------------|
| **Grafana webhook** | `POST /v1/webhooks/{tenant}/grafana` | **202 ✅** | `grafana` | `severity=critical` (from `state=alerting`), `title` from payload, `description` from `message`, `sourceAlertId` from `ruleId` |
| **CloudWatch webhook** | `POST /v1/webhooks/{tenant}/cloudwatch` | **202 ✅** | `cloudwatch` | `severity=critical` (from `NewStateValue=ALARM`), `title` from `AlarmName`, `description` from `NewStateReason`, `sourceAlertId` from `AlarmName` |
| **Sentry webhook** | `POST /v1/webhooks/{tenant}/sentry` | **202 ✅** | `sentry` | `severity=high` (from `level=error`), `title` from `data.issue.title`, `description` from `culprit`, `sourceAlertId` from `issue.id` |
| **Admin manual incident** | `POST /v1/admin/incidents` | **201 ✅** | `manual` | `status=triaging` (severity provided), `sourceAlertId` prefixed `manual-` |

**Test setup:** Local API (PORT=5183) with ministack (DynamoDB+KMS on :4566), Redis, existing dev tenant with unlimited billing account, existing Sentry integration (KMS-encrypted), and a provisioned `cflo_` API key for admin auth.

No defects found. Implementation is correct across all four parser-specific code paths.
- RepairPlan: WI-AC-016 PASS — all 4 ingestion webhook paths (Grafana, CloudWatch, Sentry, admin manual) verified against live API at PORT=5183. Parser-specific fields (severity mapping, title/description extraction, sourceAlertId) land correctly in IncidentEntity. Manual incident creates source=manual with triaging status. No defects found.
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/ingestion/WI-AC-016-2-qa.log
- NextAction: Coding Attempt 3

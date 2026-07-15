# oss-custom-investigation-llm workflow journal

## 2026-07-15T21:52:03.204Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-084
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-15T21:55:43.330Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-084
- AcceptanceChecks: AC-084
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/d58c29c1-0723-4370-91d3-f56471783a01/oss-custom-investigation-llm/WI-AC-084-1-integration_qa-9aa3381c46eff3c0.log
- NextAction: next Ready Work Item

## 2026-07-15T22:05:36.575Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-085
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-15T22:08:14.357Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-085
- AcceptanceChecks: AC-085
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/1ff04538-5c4d-41c8-ba4e-c5179fbc9933/oss-custom-investigation-llm/WI-AC-085-1-integration_qa-b46173b9a50bc827.log
- NextAction: next Ready Work Item

## 2026-07-15T22:16:40.233Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-086
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-15T22:18:16.921Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-086
- AcceptanceChecks: AC-086
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/1ff04538-5c4d-41c8-ba4e-c5179fbc9933/oss-custom-investigation-llm/WI-AC-086-1-integration_qa-572329c2723e7009.log
- NextAction: next Ready Work Item

## 2026-07-15T22:24:58.992Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-087
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-15T22:27:46.556Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-087
- AcceptanceChecks: AC-087
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/1ff04538-5c4d-41c8-ba4e-c5179fbc9933/oss-custom-investigation-llm/WI-AC-087-1-integration_qa-b5a63668bbbe8a7b.log
- NextAction: next Ready Work Item

## 2026-07-15T22:30:14.289Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-088
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-15T22:30:47.550Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-088
- AcceptanceChecks: AC-088
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/1ff04538-5c4d-41c8-ba4e-c5179fbc9933/oss-custom-investigation-llm/WI-AC-088-1-integration_qa-e07bd5abfb35a650.log
- NextAction: next Ready Work Item

## 2026-07-15T22:34:45.371Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-091
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-15T22:38:04.337Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-091
- AcceptanceChecks: AC-091
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/1ff04538-5c4d-41c8-ba4e-c5179fbc9933/oss-custom-investigation-llm/WI-AC-091-1-integration_qa-c7273cfa39ce746c.log
- NextAction: next Ready Work Item

## 2026-07-15T22:44:04.010Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-089
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-15T22:44:04.500Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-089
- Outcome: integration could not complete
- Defects: error: Unable to create '/home/vinicius/projects/causeflow-ai/.git/index.lock': File exists.

Another git process seems to be running in this repository, e.g.
an editor opened by 'git commit'. Please make sure all processes
are terminated then try again. If it still fails, a git process
may have crashed in this repository earlier:
remove the file manually to continue.
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-15T22:44:08.735Z — Resumed

- WorkItem: WI-AC-089
- PreviousPhase: blocked
- Attempt: 1
- NextAction: user-guidance

## 2026-07-15T22:47:12.483Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-089
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-15T22:48:18.347Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-089
- AcceptanceChecks: AC-089
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/80e91ba0-9d18-4fdd-b09c-833cbd124d10/oss-custom-investigation-llm/WI-AC-089-1-integration_qa-c8d6efbdb8bc7962.log
- NextAction: next Ready Work Item

## 2026-07-15T22:58:42.551Z — QA defect and Repair Plan

- Attempt: 1/3
- WorkItem: WI-AC-090
- DefectReport: expected POST /api/analyses/{id}/triage and /investigate with zero active Investigation LLM profiles to return HTTP >=400 with error containing 'Configure an Investigation LLM in Settings'; observed HTTP 404 {error:'Not Found'} for both endpoints; evidence .harness/wi-ac-090-http.json http_flow triageStatus=404 investigateStatus=404 and core dev.log POST /v1/investigation/{id}/triage 404; expected dashboard BFF to proxy triage/investigate to Core routes that exist; observed http-api-client.ts calls /v1/investigation/{id}/triage and /v1/investigation/{id}/investigate but Core mounts POST /v1/triage/{id} and POST /v1/investigation/{id}; evidence apps/dashboard/src/lib/api/http-api-client.ts lines 472-481 vs core/src/app.ts routes; expected operator-facing continue-investigation actions to surface configure-LLM message; observed useIncidentActions triage/investigation toasts receive generic 'Not Found' from broken BFF proxy; evidence manual HTTP bff triage 404 after incident create 201 with activeProfileId=null
- RepairPlan: AC-090 HTTP flow fails because dashboard http-api-client posts to non-existent Core paths (/v1/investigation/{id}/triage|/investigate) yielding 404 Not Found before fail-closed LLM checks run; Core fail-closed message exists but is unreachable. Scaffold OK.; Fix http-api-client triggerTriage → POST /v1/triage/{id}; Fix http-api-client triggerInvestigation → POST /v1/investigation/{id}; In triage-incident.usecase wrap NoActiveInvestigationLlmError as TriageFailedError (or AppError >=400) preserving Configure an Investigation LLM in Settings; Ensure investigate path keeps InvestigationFailedError message passthrough (already wraps assert); Re-run .harness/wi-ac-090 verify / http_flow with activeProfileId=null
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/80e91ba0-9d18-4fdd-b09c-833cbd124d10/oss-custom-investigation-llm/WI-AC-090-1-qa-2e39e60819d2a8b5.log
- NextAction: Coding Attempt 2

## 2026-07-15T23:09:09.194Z — Checkpoint ready

- Attempt: 2/3
- WorkItem: WI-AC-090
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-15T23:10:51.812Z — Integrated Verification passed

- Attempt: 2/3
- WorkItem: WI-AC-090
- AcceptanceChecks: AC-090
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/80e91ba0-9d18-4fdd-b09c-833cbd124d10/oss-custom-investigation-llm/WI-AC-090-2-integration_qa-3c93d4ad6ad1c809.log
- NextAction: next Ready Work Item

# oss-golden-path workflow journal

## 2026-07-17T14:31:00.784Z — Resumed

- WorkItem: WI-AC-025
- PreviousPhase: coding
- Attempt: 1
- NextAction: coding

## 2026-07-17T14:58:50.659Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-025
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-17T15:05:30.293Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-025
- AcceptanceChecks: AC-025
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/root/8f6ed257-ed75-440d-8d09-ee0398287f77/oss-golden-path/WI-AC-025-1-integration_qa-a8e7c675f991433f.log
- NextAction: next Ready Work Item

## 2026-07-17T15:20:18.823Z — Resumed

- WorkItem: WI-AC-026
- PreviousPhase: coding
- Attempt: 1
- NextAction: coding

## 2026-07-17T15:30:25.405Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-026
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-17T15:34:28.259Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-026
- AcceptanceChecks: AC-026
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/root/0dd5877c-b90f-4e81-ad5e-554bf80a55cd/oss-golden-path/WI-AC-026-1-integration_qa-8cee9c1cca1a882c.log
- NextAction: next Ready Work Item

## 2026-07-17T18:51:24.718Z — Checkpoint ready

- Attempt: 2/3
- WorkItem: WI-AC-025
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-17T18:54:17.806Z — Resumed

- WorkItem: WI-AC-025
- PreviousPhase: integration_qa
- Attempt: 2
- NextAction: integration-qa

## 2026-07-17T18:54:18.555Z — Checkpoint ready

- Attempt: 2/3
- WorkItem: WI-AC-025
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-17T18:57:40.244Z — Integrated Verification defect

- Attempt: 2/3
- WorkItem: WI-AC-025
- Defects: Integrated Verification failed
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/root/651b83db-b666-423a-bc52-87470d956cc4/oss-golden-path/WI-AC-025-2-integration_qa-e3b0c44298fc1c14.log
- NextAction: Repair Plan

## 2026-07-17T19:06:07.849Z — Operator guidance

- WorkItem: WI-AC-025
- Outcome: retryQueue / Control Host guidance applied to coding Repair Plan
- Guidance: Goal Review AC-025/AC-026 product repair (NOT verify-first). Implement Ornith ORNITH_LOCAL_PRESET.baseUrl=http://host.docker.internal:8081/v1 on gen branch, merge to plan/opensource-docker, rebuild dashboard, gate ac-025-browser-probe with shipped preset; close WI-AC-026. FORBIDDEN: VERIFY-FIRST zero-diff.
- NextAction: Coding

## 2026-07-17T19:51:20.958Z — Operator guidance

- WorkItem: WI-AC-025
- Outcome: retryQueue / Control Host guidance applied to coding Repair Plan
- Guidance: Goal Review product repair (NOT verify-first / NOT generic resume). Acceptance Checks: AC-025, AC-026. OSS compose marketing/docs/dashboard/core ACs pass (commercial hard-remove, LLM profiles, Test Application connect/unreachable, docs catalog). Golden-path AC-025/AC-026 fail on compose when activating the shipped Ornith (local) preset (baseUrl 127.0.0.1:8081 unreachable from api/worker); host.docker.internal:8081 proves the journey otherwise works. Defects:
- expected AC-025 on OSS compose: activate Ornith (local) preset → connect Test Application → ingest demo alert → investigation completes with catalog-grounded evidence + remediation; observed browser gate (web/scripts/ac-025-browser-probe.mjs) with preset baseUrl http://127.0.0.1:8081/v1 yields incident status=failed and empty evidenceByAgent (e.g. d3e1c0ee-ec01-4155-b188-6e22b5d6509a); same path with baseUrl http://host.docker.internal:8081/v1 reaches awaiting_approval/succeeded with remCount=1 and pool-exhaustion catalog evidence (7e0e393e-6281-4dde-b1af-ccc51da43732); evidence .harness/goal-review-ac025.json
- expected AC-026 documented Playwright/API gate exits 0 on local OSS stack with Ornith; observed ac-025-browser-probe against compose :3001/:3099/:5190 reports pass=false under Ornith (local) preset; evidence .harness/goal-review-ac025.json + .harness/goal-review-ac025.log FORBIDDEN: zero-diff VERIFY-FIRST pass, manual baseUrl override in probes only, or shipping 127.0.0.1:8081 for compose-reachable Ornith (local). Gate on the shipped Ornith (local) preset (host.docker.internal:8081/v1) via ac-025-browser-probe / AC docs, then commit on the gen branch before implementation=true.
- NextAction: Coding

## 2026-07-17T20:08:34.332Z — Resumed

- WorkItem: WI-AC-025
- PreviousPhase: qa
- Attempt: 3
- NextAction: qa

## 2026-07-17T20:08:34.385Z — Operator guidance

- WorkItem: WI-AC-025
- Outcome: retryQueue / Control Host guidance applied to coding Repair Plan
- Guidance: Goal Review product repair (NOT verify-first / NOT generic resume). Acceptance Checks: AC-025, AC-026. OSS compose marketing/docs/dashboard/core ACs pass (commercial hard-remove, LLM profiles, Test Application connect/unreachable, docs catalog). Golden-path AC-025/AC-026 fail on compose when activating the shipped Ornith (local) preset (baseUrl 127.0.0.1:8081 unreachable from api/worker); host.docker.internal:8081 proves the journey otherwise works. Defects:
- expected AC-025 on OSS compose: activate Ornith (local) preset → connect Test Application → ingest demo alert → investigation completes with catalog-grounded evidence + remediation; observed browser gate (web/scripts/ac-025-browser-probe.mjs) with preset baseUrl http://127.0.0.1:8081/v1 yields incident status=failed and empty evidenceByAgent (e.g. d3e1c0ee-ec01-4155-b188-6e22b5d6509a); same path with baseUrl http://host.docker.internal:8081/v1 reaches awaiting_approval/succeeded with remCount=1 and pool-exhaustion catalog evidence (7e0e393e-6281-4dde-b1af-ccc51da43732); evidence .harness/goal-review-ac025.json
- expected AC-026 documented Playwright/API gate exits 0 on local OSS stack with Ornith; observed ac-025-browser-probe against compose :3001/:3099/:5190 reports pass=false under Ornith (local) preset; evidence .harness/goal-review-ac025.json + .harness/goal-review-ac025.log FORBIDDEN: zero-diff VERIFY-FIRST pass, manual baseUrl override in probes only, or shipping 127.0.0.1:8081 for compose-reachable Ornith (local). Gate on the shipped Ornith (local) preset (host.docker.internal:8081/v1) via ac-025-browser-probe / AC docs, then commit on the gen branch before implementation=true.
- NextAction: Coding

## 2026-07-17T20:13:14.564Z — Resumed

- WorkItem: WI-AC-025
- PreviousPhase: qa
- Attempt: 3
- NextAction: qa

## 2026-07-17T20:13:14.593Z — Operator guidance

- WorkItem: WI-AC-025
- Outcome: retryQueue / Control Host guidance applied to coding Repair Plan
- Guidance: QA agent exited 130 (SIGINT); resume WI-AC-025 QA. Product coding already passed (implementation:true, Ornith host.docker.internal on plan). Prefer short compose ac-025-browser-probe verify and emit QA harness JSON verdict promptly.
- NextAction: Coding

## 2026-07-17T20:17:42.711Z — Checkpoint ready

- Attempt: 3/3
- WorkItem: WI-AC-025
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-17T20:22:45.998Z — Integrated Verification passed

- Attempt: 3/3
- WorkItem: WI-AC-025
- AcceptanceChecks: AC-025
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/root/8e428bfd-84e0-407d-9466-d09b3ae5af41/oss-golden-path/WI-AC-025-3-integration_qa-a8e7c675f991433f.log
- NextAction: next Ready Work Item

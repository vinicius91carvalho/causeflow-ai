# goal-review workflow journal

## 2026-07-17T21:06:15.703Z — Goal Review defect

- Outcome: Compose OSS stack passes marketing/dashboard/docs/commercial-removal and the Ornith golden path (AC-025/026 exit 0), but AC-018 fallback chain does not work at runtime: after the active profile fails, the shared local-llm circuit breaker opens and blocks remaining fallbackProfileId hops, so investigation fails immediately instead of using Ornith.
- AcceptanceChecks: AC-018
- Defects: expected when active Investigation LLM fails, Core follows fallbackProfileId to a healthy Ornith profile and investigation proceeds (or, if chain exhausted, fails closed with a clear configure/fix-LLM error); observed active bad baseUrl + fallbackProfileId pointing at reachable host.docker.internal:8081/v1 still yields incident status=failed within ~1s with empty evidenceByAgent, while good-only Ornith succeeds; api logs show local-llm.chat.completions.structured failed then CircuitBreakerOpenError for subsequent chain hops (incidents 25b50a3e-813a-46fa-837b-d5adb3064c71 / 04b460ab-14ec-44ad-aa15-24772e214df5); evidence .harness/goal-review-probes.json + docker logs causeflow-api
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/root/72767d26-762e-4586-b46c-ec024ac5644d/goal-review/goal-1-goal_review-d7a9251a04c2b13e.log
- NextAction: repair affected Work Items

## 2026-07-17T21:37:04.524Z — Goal Review defect

- Outcome: OSS compose marketing/dashboard/docs/commercial-removal and the Ornith golden path (AC-025/026 exit 0) pass, but AC-018 fallback still fails at runtime: after the active profile errors, the shared local-llm circuit breaker opens and blocks fallbackProfileId hops to healthy Ornith, so the investigation fails immediately with empty evidence.
- AcceptanceChecks: AC-025
- Defects: expected when active Investigation LLM fails, Core follows fallbackProfileId to a healthy Ornith profile and investigation proceeds (or, if chain exhausted, fails closed with a clear configure/fix-LLM error); observed active bad baseUrl http://127.0.0.1:1/v1 + fallbackProfileId → http://host.docker.internal:8081/v1 still yields incident status=failed with empty evidenceByAgent while good-only Ornith completes (AC-025); api logs show local-llm.chat.completions.structured failed then CircuitBreakerOpenError for subsequent chain hops (incidents f7289013-1983-4764-a7e2-21a95eecf0ae / 679c473d-99d3-4132-95ba-fe259fd63dca); evidence .harness/goal-review-ac018-strict.json + docker logs causeflow-api
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/root/10ff0f31-f4c9-4793-b842-a72b4b3656b2/goal-review/goal-1-goal_review-2feacc1913ee5c2f.log
- NextAction: repair affected Work Items

## 2026-07-17T22:14:48.709Z — Goal Review passed

- Outcome: On plan/opensource-docker with ledger 26/26 integrated, live OSS compose/HTTP/browser Goal Review passes all 26 Acceptance Checks and the Project Goal: marketing hard-removes commercial surfaces (Docs/GitHub/quiet Dashboard); dashboard has no billing/choose-plan; Investigation LLM profiles + Ornith presets + member 403s work; Test Application connects with docs Learn more; AC-018 fallback from bad active to host.docker.internal:8081 reaches awaiting_approval; pnpm verify:ac026 (ac-025-browser-probe) exits 0 with catalog-grounded evidence and remediation.
- AcceptanceChecks: 
- Defects: 
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/root/8c3bc9fa-1ec2-453d-a14c-8ba4620cf2e2/goal-review/goal-1-goal_review-2f617e4302dbeb24.log
- NextAction: Project Goal complete

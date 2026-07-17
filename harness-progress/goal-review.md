# goal-review workflow journal

## 2026-07-17T21:06:15.703Z — Goal Review defect

- Outcome: Compose OSS stack passes marketing/dashboard/docs/commercial-removal and the Ornith golden path (AC-025/026 exit 0), but AC-018 fallback chain does not work at runtime: after the active profile fails, the shared local-llm circuit breaker opens and blocks remaining fallbackProfileId hops, so investigation fails immediately instead of using Ornith.
- AcceptanceChecks: AC-018
- Defects: expected when active Investigation LLM fails, Core follows fallbackProfileId to a healthy Ornith profile and investigation proceeds (or, if chain exhausted, fails closed with a clear configure/fix-LLM error); observed active bad baseUrl + fallbackProfileId pointing at reachable host.docker.internal:8081/v1 still yields incident status=failed within ~1s with empty evidenceByAgent, while good-only Ornith succeeds; api logs show local-llm.chat.completions.structured failed then CircuitBreakerOpenError for subsequent chain hops (incidents 25b50a3e-813a-46fa-837b-d5adb3064c71 / 04b460ab-14ec-44ad-aa15-24772e214df5); evidence .harness/goal-review-probes.json + docker logs causeflow-api
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/root/72767d26-762e-4586-b46c-ec024ac5644d/goal-review/goal-1-goal_review-d7a9251a04c2b13e.log
- NextAction: repair affected Work Items

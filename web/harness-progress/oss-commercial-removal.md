# oss-commercial-removal workflow journal

## 2026-07-13T01:09:39.153Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-069
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-13T01:12:09.777Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-069
- AcceptanceChecks: AC-069
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/73274fe5-3887-4a27-9a62-d9facb0cdcfd/oss-commercial-removal/WI-AC-069-1-integration_qa-a711a44032e26dfe.log
- NextAction: next Ready Work Item

## 2026-07-13T01:28:15.746Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-073
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-13T01:41:55.917Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-070
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-13T01:44:37.540Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-070
- AcceptanceChecks: AC-070
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/989bcc86-12b5-4e03-a5f6-a4e92cf8f720/oss-commercial-removal/WI-AC-070-1-integration_qa-1ddcbde8d82ffe91.log
- NextAction: next Ready Work Item

## 2026-07-13T01:49:19.198Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-072
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-13T01:50:34.807Z — Integrated Verification defect

- Attempt: 1/3
- WorkItem: WI-AC-072
- Defects: expected Test for stub-upstream to call Core stub probe and fail with a clear unreachable error when causeflow-test-app is down; observed dashboard has zero matches for stub/probe or probeStubIntegration under apps/dashboard, handleTest in integrations-client.tsx posts to /api/integrations/test for all types including stub-upstream; evidence grep stub/probe apps/dashboard → no matches; expected Test with test-app stopped must not report success or update lastTestedAt; observed Core integration.routes.ts line 243-244 returns { success: true, message: 'Format validation passed' } for any type other than cloudwatch/aws (includes stub-upstream), and integrations-client.tsx lines 456-464 show success toast and set lastTestedAt when data.success is true; evidence static read core/src/modules/integration/infra/integration.routes.ts and apps/dashboard/src/contexts/integrations/presentation/components/integrations-client.tsx; expected Connect path fail-closed with clear unreachable message and no persisted connected record when test-app is down; observed connect-stub-integration.usecase.ts line 51 health check before line 86 upsert and line 31 throws 'Stub upstream unreachable at ${url}' — Connect path satisfies AC-072 but Test path does not; partial implementation insufficient for AC-072 pass
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/989bcc86-12b5-4e03-a5f6-a4e92cf8f720/oss-commercial-removal/WI-AC-072-1-integration_qa-8be7c91c859398d0.log
- NextAction: Repair Plan

## 2026-07-13T01:52:26.350Z — QA defect and Repair Plan

- Attempt: 1/3
- WorkItem: WI-AC-072
- DefectReport: expected Test for stub-upstream to call Core stub probe and fail with a clear unreachable error when causeflow-test-app is down; observed dashboard has zero matches for stub/probe or probeStubIntegration under apps/dashboard, handleTest in integrations-client.tsx posts to /api/integrations/test for all types including stub-upstream; evidence grep stub/probe apps/dashboard → no matches; expected Test with test-app stopped must not report success or update lastTestedAt; observed Core integration.routes.ts line 243-244 returns { success: true, message: 'Format validation passed' } for any type other than cloudwatch/aws (includes stub-upstream), and integrations-client.tsx lines 456-464 show success toast and set lastTestedAt when data.success is true; evidence static read core/src/modules/integration/infra/integration.routes.ts and apps/dashboard/src/contexts/integrations/presentation/components/integrations-client.tsx; expected Connect path fail-closed with clear unreachable message and no persisted connected record when test-app is down; observed connect-stub-integration.usecase.ts line 51 health check before line 86 upsert and line 31 throws 'Stub upstream unreachable at ${url}' — Connect path satisfies AC-072 but Test path does not; partial implementation insufficient for AC-072 pass
- RepairPlan: AC-072 fails on Test (not Connect): pre-fix Test used generic /api/integrations/test → Core /test-connection always returns success for non-AWS, so stub-upstream can toast success and set lastTestedAt while test-app is down. Scaffold (feature_list.json, init.sh) is present; on-disk WIP already adds stub/probe BFF + Core ProbeStubIntegrationUseCase + handleTest branch, but WI flags remain false and behavior is unverified.; Keep stub-upstream Test on POST /api/integrations/stub/probe → Core POST /v1/integrations/stub/probe (ProbeStubIntegrationUseCase fetch ${stubBaseUrl}/v1/probe); never /api/integrations/test for stub-upstream; Defense-in-depth: in Core integration.routes.ts /test-connection, reject type stub-upstream with clear unreachable/not-supported error instead of Format validation passed; Ensure probe/connect errors surface message containing unreachable (no success toast, no lastTestedAt/connected upsert) and cover stub-probe-handler + probe usecase unit tests; Add or extend OSS Playwright (PORT=5170 compose): stop causeflow-test-app, assert Connect and Test show clear error and no healthy/connected state; Re-run WI-AC-072 integration QA on this tree; set feature_list.json WI-AC-072 implementation/qa/integration true only after pass
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/989bcc86-12b5-4e03-a5f6-a4e92cf8f720/oss-commercial-removal/WI-AC-072-1-integration_qa-8be7c91c859398d0.log
- NextAction: Coding Attempt 2

## 2026-07-13T02:00:04.322Z — Checkpoint ready

- Attempt: 2/3
- WorkItem: WI-AC-072
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-13T02:03:35.084Z — Integrated Verification defect

- Attempt: 2/3
- WorkItem: WI-AC-072
- Defects: expected dashboard BFF `POST /api/integrations/stub/probe` and `handleTest` branch for stub-upstream; observed grep `stub/probe|probeStubIntegration` under apps/dashboard returns no matches, `integrations-client.tsx` handleTest always posts to `/api/integrations/test`, and `POST /api/integrations/stub/probe` returns HTTP 404; evidence .harness/wi-ac-072-iv-http.json stub_probe_down status 404; expected Connect with causeflow-test-app stopped to surface a clear unreachable message in the dashboard; observed Core `POST /v1/integrations/stub/connect` returns message `Stub upstream unreachable at http://causeflow-test-app:5190/health: fetch failed` but dashboard BFF returns HTTP 500 `{"error":"VALIDATION_ERROR"}` without the unreachable detail because http-api-client maps only body.error not body.message; evidence HTTP probe coreConnect vs dashConnect in .harness/wi-ac-072-iv-verify run; expected Test with test-app stopped after a connected stub-upstream to fail via stub probe with unreachable error and not mark healthy; observed UI/API Test still uses generic `/api/integrations/test` → Core `/test-connection` which returns `success:false` with `does not support generic test-connection` (not an unreachable probe), while Core `POST /v1/integrations/stub/probe` correctly returns unreachable when test-app is down but has no dashboard route; evidence coreProbe message `Stub upstream unreachable` vs dashTest message `does not support generic test-connection`; expected no false connected/healthy state when test-app is down; observed Connect correctly does not persist integration on failure (stub_connect_down HTTP 500, connect only succeeds when test-app healthy), and generic Test does not set success:true, but AC-072 Test reachability requirement is unmet because stub probe is not wired through the dashboard
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/989bcc86-12b5-4e03-a5f6-a4e92cf8f720/oss-commercial-removal/WI-AC-072-2-integration_qa-15c1ff71e3bb8fe0.log
- NextAction: Repair Plan

## 2026-07-13T02:05:49.303Z — QA defect and Repair Plan

- Attempt: 2/3
- WorkItem: WI-AC-072
- DefectReport: expected dashboard BFF `POST /api/integrations/stub/probe` and `handleTest` branch for stub-upstream; observed grep `stub/probe|probeStubIntegration` under apps/dashboard returns no matches, `integrations-client.tsx` handleTest always posts to `/api/integrations/test`, and `POST /api/integrations/stub/probe` returns HTTP 404; evidence .harness/wi-ac-072-iv-http.json stub_probe_down status 404; expected Connect with causeflow-test-app stopped to surface a clear unreachable message in the dashboard; observed Core `POST /v1/integrations/stub/connect` returns message `Stub upstream unreachable at http://causeflow-test-app:5190/health: fetch failed` but dashboard BFF returns HTTP 500 `{"error":"VALIDATION_ERROR"}` without the unreachable detail because http-api-client maps only body.error not body.message; evidence HTTP probe coreConnect vs dashConnect in .harness/wi-ac-072-iv-verify run; expected Test with test-app stopped after a connected stub-upstream to fail via stub probe with unreachable error and not mark healthy; observed UI/API Test still uses generic `/api/integrations/test` → Core `/test-connection` which returns `success:false` with `does not support generic test-connection` (not an unreachable probe), while Core `POST /v1/integrations/stub/probe` correctly returns unreachable when test-app is down but has no dashboard route; evidence coreProbe message `Stub upstream unreachable` vs dashTest message `does not support generic test-connection`; expected no false connected/healthy state when test-app is down; observed Connect correctly does not persist integration on failure (stub_connect_down HTTP 500, connect only succeeds when test-app healthy), and generic Test does not set success:true, but AC-072 Test reachability requirement is unmet because stub probe is not wired through the dashboard
- RepairPlan: AC-072 failed because stub-upstream Test used generic `/api/integrations/test` (no dashboard stub/probe BFF) and Connect hid Core unreachable text via http-api-client mapping only `body.error`. WIP now adds stub/probe route+handler, handleTest branch, message preference, Core defense, and ac-072 E2E; revalidate after fixing container name default.; Align `tests/oss/ac-072-test-app-unreachable.spec.ts` default `OSS_TEST_APP_CONTAINER` with compose `container_name: causeflow-test-app` (or env for umbrella naming).; Confirm WIP complete: `stub/probe` route+handler, `integrations-client` stub-upstream Test→`/api/integrations/stub/probe`, Connect→stub/connect, `http-api-client` prefers `body.message`, Core rejects stub-upstream on `/test-connection`.; Run vitest for stub-probe/stub-connect handlers and http-api-client message mapping.; Restart OSS stack on PORT=5170 so dashboard serves the WIP (avoid stale 404 on stub/probe).; Run `pnpm exec playwright test --project=dashboard-oss-e2e tests/oss/ac-072-test-app-unreachable.spec.ts` then harness IV; flip WI-AC-072 flags only on pass.
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/989bcc86-12b5-4e03-a5f6-a4e92cf8f720/oss-commercial-removal/WI-AC-072-2-integration_qa-15c1ff71e3bb8fe0.log
- NextAction: Coding Attempt 3

## 2026-07-13T02:16:26.994Z — Checkpoint ready

- Attempt: 3/3
- WorkItem: WI-AC-072
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-13T02:22:29.532Z — Integrated Verification passed

- Attempt: 3/3
- WorkItem: WI-AC-072
- AcceptanceChecks: AC-072
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/989bcc86-12b5-4e03-a5f6-a4e92cf8f720/oss-commercial-removal/WI-AC-072-3-integration_qa-76945442b6f78a02.log
- NextAction: next Ready Work Item

## 2026-07-13T02:22:29.862Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-073
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-13T02:26:53.034Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-073
- AcceptanceChecks: AC-073
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/989bcc86-12b5-4e03-a5f6-a4e92cf8f720/oss-commercial-removal/WI-AC-073-1-integration_qa-e988e795d52bf7fc.log
- NextAction: next Ready Work Item

## 2026-07-13T02:28:03.679Z — Resumed

- WorkItem: WI-AC-071
- PreviousPhase: claimed
- Attempt: 1
- NextAction: start-orchestrator

## 2026-07-13T02:50:28.088Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-071
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-13T02:55:24.329Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-071
- AcceptanceChecks: AC-071
- Outcome: passed on integrated branch
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/5dc17bff-f85b-4421-acde-417406b8052a/oss-commercial-removal/WI-AC-071-1-integration_qa-95a325217a278fa1.log
- NextAction: next Ready Work Item

## 2026-07-13T03:01:56.401Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-074
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-13T03:04:12.255Z — Integrated Verification defect

- Attempt: 1/3
- WorkItem: WI-AC-074
- Defects: expected POST /api/incidents to succeed without 402 CREDITS_EXHAUSTED for a fresh OSS tenant creating investigations beyond a 3-credit free tier; observed attempts 1-3 returned 201 then attempts 4-5 returned 402 with body {"code":"CREDITS_EXHAUSTED"}; evidence .harness/wi-ac-074-iv-http.json create_incidents.creates[3].status=402 and creates[4].status=402; expected no local credits ledger or commercial quota gate on investigation create (PD-OSS-BILLING-PURGE); observed incidents-create-handler.ts still calls consumeCredit() from credits-ledger.ts before proxying to Core; evidence apps/dashboard/src/contexts/investigation/api/incidents-create-handler.ts lines 50-53; expected operators not to see remaining-credit limits on OSS; observed GET /api/metrics returned creditsTotal=3 creditsRemaining=3 creditsUsed=0 for fresh tenant and subscription endpoint returned creditsRemaining=3; evidence .harness/wi-ac-074-iv-http.json steps metrics.body.metrics and subscription.body
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/5dc17bff-f85b-4421-acde-417406b8052a/oss-commercial-removal/WI-AC-074-1-integration_qa-84f8d2e7dd782c46.log
- NextAction: Repair Plan

## 2026-07-13T03:06:13.087Z — QA defect and Repair Plan

- Attempt: 1/3
- WorkItem: WI-AC-074
- DefectReport: expected POST /api/incidents to succeed without 402 CREDITS_EXHAUSTED for a fresh OSS tenant creating investigations beyond a 3-credit free tier; observed attempts 1-3 returned 201 then attempts 4-5 returned 402 with body {"code":"CREDITS_EXHAUSTED"}; evidence .harness/wi-ac-074-iv-http.json create_incidents.creates[3].status=402 and creates[4].status=402; expected no local credits ledger or commercial quota gate on investigation create (PD-OSS-BILLING-PURGE); observed incidents-create-handler.ts still calls consumeCredit() from credits-ledger.ts before proxying to Core; evidence apps/dashboard/src/contexts/investigation/api/incidents-create-handler.ts lines 50-53; expected operators not to see remaining-credit limits on OSS; observed GET /api/metrics returned creditsTotal=3 creditsRemaining=3 creditsUsed=0 for fresh tenant and subscription endpoint returned creditsRemaining=3; evidence .harness/wi-ac-074-iv-http.json steps metrics.body.metrics and subscription.body
- RepairPlan: WI-AC-074 fails because the OSS BFF still runs the AC-022 local credits ledger (3 free credits) on create and still exposes creditsRemaining via metrics/subscription; WIP only partially removed the create gate.; Keep consumeCredit removed from incidents-create-handler (and analyses-handler); do not reintroduce a local ledger gate before Core proxy; Purge or OSS-disable credits-ledger.ts (consumeCredit/resolveCredits) so no in-memory 3-credit free tier remains; Strip creditsTotal/creditsRemaining/creditsUsed from metrics-handler and subscription-handler (prefer 410 Gone per AC-076, not free-plan stub payloads); Remove/neutralize FREE_PLAN_MONTHLY_CREDITS runtime use and update billing/metrics unit tests that assert creditsRemaining=3; Rebuild/restart dashboard on PORT=5170 so IV no longer hits a stale process with the old create gate
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/5dc17bff-f85b-4421-acde-417406b8052a/oss-commercial-removal/WI-AC-074-1-integration_qa-84f8d2e7dd782c46.log
- NextAction: Coding Attempt 2

## 2026-07-13T03:13:34.882Z — Checkpoint ready

- Attempt: 2/3
- WorkItem: WI-AC-074
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-13T03:15:25.206Z — Integrated Verification defect

- Attempt: 2/3
- WorkItem: WI-AC-074
- Defects: expected POST /api/incidents to succeed without 402 CREDITS_EXHAUSTED for a fresh OSS tenant creating investigations beyond a 3-credit free tier; observed attempts 1-3 returned 201 then attempts 4-5 returned 402 with body {"code":"CREDITS_EXHAUSTED"}; evidence .harness/wi-ac-074-iv-http.json create_incidents.creates[3].status=402 and creates[4].status=402; expected no local credits ledger or commercial quota gate on investigation create (PD-OSS-BILLING-PURGE); observed incidents-create-handler.ts still calls consumeCredit() from credits-ledger.ts before proxying to Core; evidence apps/dashboard/src/contexts/investigation/api/incidents-create-handler.ts lines 50-53; expected operators not to see remaining-credit limits on OSS; observed GET /api/metrics returned creditsTotal=3 creditsRemaining=3 creditsUsed=0 for fresh tenant and GET /api/billing/subscription returned creditsRemaining=3; evidence .harness/wi-ac-074-iv-http.json steps metrics.body.metrics and subscription.body
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/5dc17bff-f85b-4421-acde-417406b8052a/oss-commercial-removal/WI-AC-074-2-integration_qa-2aaac661c206b4d5.log
- NextAction: Repair Plan

## 2026-07-13T03:17:11.815Z — QA defect and Repair Plan

- Attempt: 2/3
- WorkItem: WI-AC-074
- DefectReport: expected POST /api/incidents to succeed without 402 CREDITS_EXHAUSTED for a fresh OSS tenant creating investigations beyond a 3-credit free tier; observed attempts 1-3 returned 201 then attempts 4-5 returned 402 with body {"code":"CREDITS_EXHAUSTED"}; evidence .harness/wi-ac-074-iv-http.json create_incidents.creates[3].status=402 and creates[4].status=402; expected no local credits ledger or commercial quota gate on investigation create (PD-OSS-BILLING-PURGE); observed incidents-create-handler.ts still calls consumeCredit() from credits-ledger.ts before proxying to Core; evidence apps/dashboard/src/contexts/investigation/api/incidents-create-handler.ts lines 50-53; expected operators not to see remaining-credit limits on OSS; observed GET /api/metrics returned creditsTotal=3 creditsRemaining=3 creditsUsed=0 for fresh tenant and GET /api/billing/subscription returned creditsRemaining=3; evidence .harness/wi-ac-074-iv-http.json steps metrics.body.metrics and subscription.body
- RepairPlan: AC-074 failed because the OSS dashboard still enforced the AC-022 in-memory 3-credit ledger and returned free-tier credit counters; WIP already deletes that gate, but IV must re-run against a restarted PORT=5170 process with the purged handlers.; Keep/finish WIP: no consumeCredit on POST /api/incidents; delete credits-ledger.ts; metrics omit creditsTotal/Remaining/Used; subscription return 410 without credit fields; Kill and restart dashboard on PORT=5170 so IV does not hit a stale pre-purge Next process; Strip or hard-disable remaining-credit chrome on create path (use-credits/credits-banner/new-incident CREDITS_EXHAUSTED modal) so operators never see 3-credit limits; Add/keep handler + OSS E2E coverage: 5+ creates all non-402; metrics has no credit fields; subscription 410
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/5dc17bff-f85b-4421-acde-417406b8052a/oss-commercial-removal/WI-AC-074-2-integration_qa-2aaac661c206b4d5.log
- NextAction: Coding Attempt 3

## 2026-07-13T03:22:51.164Z — Checkpoint ready

- Attempt: 3/3
- WorkItem: WI-AC-074
- Outcome: isolated QA passed
- NextAction: Integrated Verification

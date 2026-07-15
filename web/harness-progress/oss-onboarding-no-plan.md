# oss-onboarding-no-plan workflow journal

## 2026-07-15T17:28:34.644Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-081
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-15T17:32:50.159Z — Integrated Verification defect

- Attempt: 1/3
- WorkItem: WI-AC-081
- Defects: expected post create-organization route to /dashboard or next non-plan onboarding step without requiring /onboarding/choose-plan; observed create-organization-page.tsx unconditionally calls redirect('/onboarding/choose-plan') on both branches (lines 17 and 21); evidence static audit apps/dashboard/src/contexts/identity/presentation/pages/create-organization-page.tsx; expected fresh OSS tenant after org bootstrap to skip commercial plan selection; observed GET /onboarding/choose-plan returns HTTP 200 with Starter/Pro/Business plan cards because GET /api/billing/subscription returns 410 Gone and choose-plan-page only auto-redirects when res.ok; evidence .harness/wi-ac-081-iv-http.json choose_plan_direct_chain.hasCommercialPlanCards=true; expected sign-up flow POST /api/auth/register then GET /create-organization to reach dashboard or non-plan onboarding; observed redirect loop between /create-organization and /en/create-organization (never reaches /dashboard); evidence .harness/wi-ac-081-iv-http.json create_organization_redirect_chain
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-evidence/web/db6524ef-d6c0-44eb-873f-2851df0e3b96/oss-onboarding-no-plan/WI-AC-081-1-integration_qa-702f8f6bc1706f9f.log
- NextAction: Repair Plan

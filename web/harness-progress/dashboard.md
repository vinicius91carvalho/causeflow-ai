# dashboard workflow journal

## 2026-07-07T23:24:31.170Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-028
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-07T23:31:00Z — Integrated Verification (WI-AC-028)

- Verified dashboard src/contexts/ contains exactly 10 contexts: approvals, audit, billing, identity, integrations, investigation, onboarding, settings, shared, team.
- Verified website src/contexts/ contains exactly 3 contexts: legal, marketing, shell.
- DDD layers per context are minimal/sufficient: billing/investigation/onboarding have application+domain+infra+presentation+api; approvals/audit/identity/integrations/settings/team have domain+infra+presentation+api; website contexts have only the layers they need (legal: infra+presentation; marketing: domain+infra+presentation; shell: api+infra+presentation).
- No context index.ts barrel files exist in either app (find -maxdepth 2 -name index.ts under contexts/ returns empty).
- Per-context i18n files exist at infrastructure/i18n/{en,pt-br}.json for every context in both apps (onboarding also has a colocated i18n.test.ts).
- compose.ts at apps/{dashboard,website}/src/lib/i18n/compose.ts imports each context's i18n files and deep-merges them via @causeflow/shared/domain/utils/deep-merge.
- Outcome: PASS — integration=true.

## 2026-07-07T23:26:02.989Z — Integrated Verification passed

- Attempt: 1/3
- WorkItem: WI-AC-028
- AcceptanceChecks: AC-028
- Outcome: passed on integrated main
- Evidence: /home/vinicius/projects/causeflow-ai/.git/harness-runs/evidence/dashboard/WI-AC-028-1-integration_qa.log
- NextAction: next Ready Work Item

## 2026-07-07T23:42:00Z — Verify-First (WI-AC-037)

- AcceptanceChecks: AC-037
- Context: dashboard
- AC: `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` limited to exactly two paths; dashboard runtime never holds AWS credentials.
- Static checks (existing code):
  - `grep -rn "@aws-sdk" apps/dashboard/src` → only `tenant-provisioning-fallback.ts` (+ its `.test.ts` using `vi.doMock`). ✓
  - `grep -rn "@aws-sdk" apps/dashboard/scripts` → only `delete-user.ts`. ✓
  - `apps/dashboard/.env.example` lists no `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (only `AWS_REGION`, allowed). ✓
  - `delete-user.ts`: `--yes`/`-y` gate, ScanCommand + BatchWriteCommand scoped to tenantId, `stripe.customers.del` cancel. ✓
  - `tenant-provisioning-fallback.ts`: writes `Tenant` + `BillingAccount` via BatchWriteCommand in ElectroDB wire format. ✓
- Failing check found & root-cause fixed (smallest diff): `complete-profile-handler.ts` did NOT call the fallback on a 403 from Core. Added import of `provisionTenantDirect` + `CoreApiError` and a 403 branch in the catch that calls `provisionTenantDirect({tenantId: orgId, name, slug, ownerEmail})` (no refactor of the conflict/else branches).
- Black-box boundary evidence:
  - Brought dashboard dev server up on assigned port 5173 with no `.env.local` and no AWS env vars → `Ready in 2.8s`, port listening, `GET /api/health` → `200 {"status":"ok","version":"0.1.0",...}`. Runtime boots/serves without AWS credentials (proves runtime never holds them; SDK only touched on the 403 fallback path).
  - Vitest boundary test added: `complete-profile-handler.test.ts` — when `createTenant` rejects with `CoreApiError(...,403)`, POST returns 200 with `tenantId=org_1` and `provisionTenantDirect` is called once with the expected args.
- Verification: `tsc --noEmit -p tsconfig.build.json` exit 0; `vitest run --project dashboard` → 163 files / 1073 tests pass; `biome check` clean (auto-fixed formatting).
- Outcome: PASS — implementation=true.

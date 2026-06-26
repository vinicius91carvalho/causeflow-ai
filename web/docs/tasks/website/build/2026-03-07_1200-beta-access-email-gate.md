# Beta Access Email Gate on Website Dashboard Link

## Context (The Why)
In production, clicking "Dashboard" on the website currently opens a `DashboardDemoModal` with a video on the left and a waitlist form on the right. We want to add an email-check step first: if the email is on the beta allowlist (already in DynamoDB from Task 2), redirect to the dashboard; if not, show the existing demo modal.

## Definition (The What)
Replace the direct `DashboardDemoModal` trigger (in production) with a two-step flow:
1. **Step 1 — Email Check Modal**: Simple modal with email input + "Check Access" button
2. **Step 2a — Allowed**: Redirect to `SITE.dashboardUrl` (the dashboard)
3. **Step 2b — Not Allowed**: Close email modal, open the existing `DashboardDemoModal` (video + waitlist form)

The website needs a new API route (`POST /api/check-beta-access`) that queries the dashboard's DynamoDB table for the `BETA_ALLOWLIST` partition.

## Acceptance Criteria (The How to Test)
- [x] Clicking "Dashboard" in production opens a simple email input modal (not the demo modal)
- [x] Entering an allowlisted email and submitting redirects to `SITE.dashboardUrl`
- [x] Entering a non-allowlisted email closes the email modal and opens the `DashboardDemoModal`
- [x] Both desktop header and mobile menu use the new flow
- [x] In staging/dev, "Dashboard" still links directly to `SITE.dashboardUrl` (no modal)
- [x] API route validates email format and is rate-limited
- [x] Build passes, lint clean, types clean

## Restrictions (The Boundaries)
- Do NOT modify the existing `DashboardDemoModal` content/layout — it stays as-is (video + form)
- Do NOT break the staging/dev direct link behavior
- Keep the website SSG — only the API route runs server-side
- Reuse the existing DynamoDB single-table design (PK=`BETA_ALLOWLIST`, SK=`EMAIL#<email>`)
- No new npm dependencies — `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb` are already in the monorepo

## Phase 1: Research & Setup
- [x] Check if `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb` are available in the monorepo
- [x] Check dashboard's DynamoDB table naming pattern in `apps/dashboard/sst.config.ts`
- [x] Check SST v3 Nextjs `permissions` syntax for adding IAM policies
- [x] Identify the dashboard's DynamoDB table ARN pattern: `arn:aws:dynamodb:us-east-2:409171461008:table/causeflow-dashboard-{stage}`

## Phase 2: Tests (write first)
- [x] Write unit test for the beta check API handler (allowed email, not-allowed email, invalid email)
- [x] Write unit test for the BetaAccessModal component (renders email input, handles submit)

## Phase 3: Implementation

### 3.1: SST Configuration
- [x] Add `DYNAMODB_TABLE_NAME` env var to `apps/website/sst.config.ts` (value: dashboard table name per stage)
- [x] Add IAM `dynamodb:GetItem` permission on the dashboard's DynamoDB table in `sst.config.ts`
- [x] Add `AWS_REGION` env var if not already available (for DynamoDB client)

### 3.2: Domain & Infrastructure
- [x] Add `BetaCheckPayload` and `BetaCheckResponse` types to `apps/website/src/contexts/engagement/domain/types.ts`
- [x] Add `checkBetaAccess` client function to `apps/website/src/contexts/engagement/infrastructure/api-client.ts`
- [x] Create `apps/website/src/contexts/engagement/api/check-beta-handler.ts` — API handler that queries DynamoDB for `BETA_ALLOWLIST` / `EMAIL#<email>`

### 3.3: API Route
- [x] Create `apps/website/src/app/api/check-beta-access/route.ts` — Thin re-export of the handler

### 3.4: UI Components
- [x] Create `apps/website/src/contexts/engagement/presentation/components/beta-access-modal.tsx`:
  - Dialog with email input + "Check Access" button
  - Loading state while checking
  - On allowed: `window.location.href = SITE.dashboardUrl`
  - On not-allowed: Close this modal, trigger `DashboardDemoModal` open
- [x] Modify `DashboardDemoModal` to support external open control (add optional `open`/`onOpenChange` props, or use a wrapper pattern)

### 3.5: Wire Up Navigation
- [x] Update `header.tsx` — Replace `DashboardDemoModal` wrapper with `BetaAccessModal` (production only)
- [x] Update `mobile-menu.tsx` — Same change for mobile

### 3.6: i18n
- [x] Add i18n strings for the email check modal (EN + PT-BR) in `engagement/infrastructure/i18n/`

## Phase 4: E2E & Validation
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Run `pnpm turbo test` — all tests pass
- [x] Start dev server and verify no server-side errors
- [x] Code review (clean + performant)
- [x] Security check (email validation, rate limiting, no credential leakage)
- [x] Remove unused code/imports

## Phase 6: Compound
- [x] Capture learnings under `## Learnings`
- [x] If a new reusable pattern emerged, create solution doc in `docs/solutions/`
- [x] Update session-learnings.md
- [x] Update relevant docs if needed (website CLAUDE.md routes, API reference)

## Architecture Notes

### Flow Diagram
```
User clicks "Dashboard" (production)
  -> BetaAccessModal opens (email input)
  -> User enters email + clicks "Check Access"
  -> POST /api/check-beta-access { email }
  -> Server: DynamoDB GetItem(BETA_ALLOWLIST, EMAIL#<email>)
  -> { allowed: true }  => window.location.href = SITE.dashboardUrl
  -> { allowed: false } => Close BetaAccessModal, open DashboardDemoModal
```

### Files to Create
- `apps/website/src/contexts/engagement/api/check-beta-handler.ts`
- `apps/website/src/app/api/check-beta-access/route.ts`
- `apps/website/src/contexts/engagement/presentation/components/beta-access-modal.tsx`

### Files to Modify
- `apps/website/sst.config.ts` (env + IAM)
- `apps/website/src/contexts/engagement/domain/types.ts` (types)
- `apps/website/src/contexts/engagement/infrastructure/api-client.ts` (client function)
- `apps/website/src/contexts/shell/presentation/components/navigation/header.tsx`
- `apps/website/src/contexts/shell/presentation/components/navigation/mobile-menu.tsx`
- `apps/website/src/contexts/engagement/presentation/components/dashboard-demo-modal.tsx` (external open control)
- `apps/website/src/contexts/engagement/infrastructure/i18n/en.json`
- `apps/website/src/contexts/engagement/infrastructure/i18n/pt-br.json`

## Learnings

1. **vi.hoisted() is required for vi.mock factories referencing outer variables**: Vitest hoists `vi.mock()` calls above all other code, so `const mockSend = vi.fn()` isn't initialized when the factory runs. Using `vi.hoisted()` ensures the variable is available.
2. **Use classes (not plain functions) for AWS SDK mocks**: `DynamoDBClient` is instantiated with `new`, so the mock must be a class, not `vi.fn().mockImplementation(() => ({}))`, which triggers Vitest warnings.
3. **Cross-app DynamoDB access works well with scoped IAM**: The website only needs `dynamodb:GetItem` on the dashboard table. SST `permissions` array syntax is straightforward.
4. **Dialog external control pattern**: Adding `externalOpen`/`onExternalOpenChange` props with internal state fallback makes components work both as self-contained and externally-controlled dialogs.

### DynamoDB Access Pattern
- Table: `causeflow-dashboard-{stage}` (same table the dashboard uses)
- Query: `GetItem({ pk: "BETA_ALLOWLIST", sk: "EMAIL#<normalized_email>" })`
- IAM: `dynamodb:GetItem` scoped to the table ARN

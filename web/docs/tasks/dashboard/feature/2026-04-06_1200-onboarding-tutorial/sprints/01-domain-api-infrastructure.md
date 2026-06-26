# Sprint 1: Domain + API + Infrastructure

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 1 of 4
- **Depends on:** None
- **Batch:** 1 (sequential)
- **Model:** sonnet
- **Estimated effort:** M

## Objective

Create the `onboarding` bounded context with domain types, DynamoDB repository, API endpoints (GET + PATCH `/api/onboarding/progress`), and Zod validation schemas.

## File Boundaries

### Creates (new files)

- `apps/dashboard/src/contexts/onboarding/domain/types.ts` — OnboardingProgress, StepKey, OnboardingStepStatus, step config constants
- `apps/dashboard/src/contexts/onboarding/infrastructure/onboarding-repository.ts` — DynamoDB CRUD for onboarding progress
- `apps/dashboard/src/contexts/onboarding/infrastructure/api-schema.ts` — Zod schemas for API request validation
- `apps/dashboard/src/contexts/onboarding/api/progress-handler.ts` — GET + PATCH handler logic
- `apps/dashboard/src/app/api/onboarding/progress/route.ts` — Thin re-export of handler

### Modifies (can touch)

- `apps/dashboard/src/contexts/shared/domain/types.ts` — Add `buildOnboardingSK()` key builder function

### Read-Only (reference but do NOT modify)

- `apps/dashboard/src/lib/db/client.ts` — DynamoDB client singleton pattern
- `apps/dashboard/src/lib/api/with-auth.ts` — API auth HOC pattern
- `apps/dashboard/src/contexts/integrations/infrastructure/integration-repository.ts` — Repository pattern reference
- `apps/dashboard/src/contexts/billing/infrastructure/api-schema.ts` — Zod schema pattern reference
- `apps/dashboard/src/contexts/billing/api/subscription-handler.ts` — API handler pattern reference

### Shared Contracts (consume from prior sprints or PRD)

- `OnboardingProgress` interface (defined in this sprint)
- `StepKey` type (defined in this sprint)
- `OnboardingStepStatus` type (defined in this sprint)
- DynamoDB key pattern: PK=`TENANT#<tenantId>`, SK=`ONBOARDING`

### Consumed Invariants (from INVARIANTS.md)

- Onboarding step keys — this sprint defines them: `welcome|integrations|relay|firstIncident|receiveEvents|billing|complete`
- Onboarding step status — this sprint defines them: `pending|completed|skipped`
- Onboarding DynamoDB SK — this sprint defines it: `ONBOARDING`
- Onboarding API paths — this sprint creates them: `/api/onboarding/progress` (GET + PATCH)

## Tasks

- [ ] Create `onboarding/domain/types.ts` with `OnboardingProgress`, `StepKey`, `OnboardingStepStatus`, `STEP_KEYS` constant array, `STEP_CONFIG` mapping (key -> href, label key, icon name)
- [ ] Create `onboarding/infrastructure/onboarding-repository.ts` with:
  - `getOnboardingProgress(tenantId: string): Promise<OnboardingProgress | null>`
  - `createOnboardingProgress(tenantId: string): Promise<OnboardingProgress>` — initializes all steps as `pending`
  - `updateStepStatus(tenantId: string, step: StepKey, status: OnboardingStepStatus): Promise<OnboardingProgress>`
  - `skipOnboarding(tenantId: string): Promise<OnboardingProgress>`
  - `completeOnboarding(tenantId: string): Promise<OnboardingProgress>`
- [ ] Create `onboarding/infrastructure/api-schema.ts` with Zod schema for PATCH request body (`step`, `action`)
- [ ] Create `onboarding/api/progress-handler.ts` with:
  - GET: returns `{ progress: OnboardingProgress | null }` — null means no record (existing user)
  - PATCH: accepts `{ step?, action: 'complete' | 'skip' | 'skip_all' | 'start' }` — updates progress and returns updated record
  - `start` action: creates initial progress record if none exists
- [ ] Create `app/api/onboarding/progress/route.ts` as thin re-export
- [ ] Add `buildOnboardingSK()` to `shared/domain/types.ts` returning `'ONBOARDING'`
- [ ] Write unit tests for repository (mocking DynamoDB client) and API handler

## Acceptance Criteria

- [ ] `GET /api/onboarding/progress` returns `{ progress: null }` for tenants without onboarding record
- [ ] `PATCH /api/onboarding/progress { action: 'start' }` creates initial record with all steps `pending`
- [ ] `PATCH /api/onboarding/progress { step: 'integrations', action: 'complete' }` marks that step as `completed`
- [ ] `PATCH /api/onboarding/progress { action: 'skip_all' }` marks onboarding as `skipped: true`
- [ ] API handlers require auth (use `withAuth()`)
- [ ] All types are exported and consumable by Sprint 2

## Verification

- [ ] Build passes: `pnpm turbo build`
- [ ] Lint passes: `pnpm exec biome check .`
- [ ] Type-check passes: `pnpm turbo check-types`
- [ ] Unit tests pass for repository and API handler

## Context

**DynamoDB patterns to follow:**

The project uses a single-table DynamoDB design. See `shared/domain/types.ts` for key builder functions (`buildPK`, `buildTenantSK`, etc.). The onboarding record follows the same pattern:
- PK: `TENANT#<tenantId>` (same as all tenant-scoped records)
- SK: `ONBOARDING` (new, unique to this entity)

**API handler pattern:**

Use `withAuth()` HOC from `lib/api/with-auth.ts`. It provides `session` with `tenantId`. See `billing/api/subscription-handler.ts` for the pattern. The handler should return proper HTTP status codes (200, 201, 400, 404).

**Repository pattern:**

See `integrations/infrastructure/integration-repository.ts` for the standard DynamoDB repository pattern used in this project. Use `GetCommand`, `PutCommand`, `UpdateCommand` from `@aws-sdk/lib-dynamodb`.

## Agent Notes (filled during execution)

- Assigned to: [Agent ID / session]
- Started: [timestamp]
- Completed: [timestamp]
- Decisions made: [list with reasoning]
- Assumptions: [list with confidence level]
- Issues found: [list]

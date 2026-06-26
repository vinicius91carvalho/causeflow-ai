# Architecture Invariants: Onboarding Tutorial

## Onboarding Step Keys

- **Owner:** `onboarding` domain (`contexts/onboarding/domain/types.ts`)
- **Preconditions:** Consumers must import `StepKey` type from the domain; never define step keys locally
- **Postconditions:** The type is a union of exactly 7 string literals
- **Invariants:** Step keys are: `welcome | integrations | relay | firstIncident | receiveEvents | billing | complete`. These are used in: domain types, API schema validation, DynamoDB records, i18n key namespaces, UI components, step highlight configs.
- **Verify:** `grep -c "type StepKey" apps/dashboard/src/contexts/onboarding/domain/types.ts | grep -q "1"`
- **Fix:** If step keys are defined in multiple places, consolidate to `domain/types.ts` and import everywhere else.

## Onboarding Step Status

- **Owner:** `onboarding` domain (`contexts/onboarding/domain/types.ts`)
- **Preconditions:** Status transitions: `pending -> completed`, `pending -> skipped`. No other transitions.
- **Postconditions:** A step status is always one of the three valid values
- **Invariants:** Status values are: `pending | completed | skipped`. The `complete` step (final) only supports `pending | completed` (cannot be skipped).
- **Verify:** `grep -c "OnboardingStepStatus" apps/dashboard/src/contexts/onboarding/domain/types.ts | grep -q "1"`
- **Fix:** Status type must be defined once in domain types and imported by all consumers.

## Onboarding DynamoDB Key Pattern

- **Owner:** `onboarding` infrastructure (`contexts/onboarding/infrastructure/onboarding-repository.ts`)
- **Preconditions:** `tenantId` must be a valid non-empty string
- **Postconditions:** Record is stored at PK=`TENANT#<tenantId>`, SK=`ONBOARDING`
- **Invariants:** The SK is always the literal string `ONBOARDING`. The key builder function `buildOnboardingSK()` in `shared/domain/types.ts` returns this value. Only one onboarding record per tenant.
- **Verify:** `grep "ONBOARDING" apps/dashboard/src/contexts/shared/domain/types.ts | grep -q "buildOnboardingSK"`
- **Fix:** Ensure `buildOnboardingSK()` exists in `shared/domain/types.ts` and returns `'ONBOARDING'`.

## Onboarding API Contract

- **Owner:** `onboarding` API (`contexts/onboarding/api/progress-handler.ts`)
- **Preconditions:** Requests must include valid Clerk session with `orgId`. PATCH body must pass Zod validation.
- **Postconditions:** GET returns `{ progress: OnboardingProgress | null }`. PATCH returns `{ progress: OnboardingProgress }`.
- **Invariants:** API path is `/api/onboarding/progress`. Supports GET and PATCH methods only. Protected by `withAuth()`. PATCH actions: `start | complete | skip | skip_all`.
- **Verify:** `test -f apps/dashboard/src/app/api/onboarding/progress/route.ts`
- **Fix:** Create the route file as a thin re-export of the handler.

## Onboarding i18n Namespace

- **Owner:** `onboarding` infrastructure (`contexts/onboarding/infrastructure/i18n/`)
- **Preconditions:** Both `en.json` and `pt-br.json` must exist and have identical key structures
- **Postconditions:** All onboarding UI strings are available via `useTranslations('onboarding')`
- **Invariants:** Namespace is `onboarding`. Step title/description keys match step keys from domain. `compose.ts` includes onboarding in the merge.
- **Verify:** `test -f apps/dashboard/src/contexts/onboarding/infrastructure/i18n/en.json && test -f apps/dashboard/src/contexts/onboarding/infrastructure/i18n/pt-br.json`
- **Fix:** Create missing i18n files with the required key structure.

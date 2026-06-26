# Terms Acceptance Tracking with Data Collection Disclosure

## Context (The Why)
CauseFlow AI's agent collects data from customer companies during incident investigation. We need to clearly disclose this in our Terms & Conditions and track user consent with full audit trail. Currently, the sign-up page has a T&C checkbox but nothing is persisted to the database. Users must explicitly accept updated terms after providing company details during onboarding.

## Definition (The What)
1. Update Terms & Conditions content to add a "Data Collection & Usage" section explaining the agent collects company data but CauseFlow will not use/sell/share this information
2. Version the Terms & Conditions (e.g., `v2026.03.06`)
3. Add a T&C acceptance step to the complete-profile onboarding page (after company details)
4. Create a `TermsAcceptance` DynamoDB entity to store: T&C version, timestamp, IP address, User Agent
5. Save the acceptance record when the user completes their profile

## Acceptance Criteria (The How to Test)
- [ ] Terms page on website includes new "Data Collection & Usage" section
- [ ] Complete-profile page has a T&C acceptance checkbox that must be checked
- [ ] Submitting complete-profile without accepting T&C shows validation error
- [ ] On successful submission, a `TermsAcceptance` record is saved with: version, timestamp, IP, User Agent
- [ ] The acceptance record is queryable by userId and tenantId
- [ ] Existing sign-up flow still works (sign-up checkbox remains as-is)
- [ ] i18n: both EN and PT-BR translations for new T&C content and checkbox labels
- [ ] All tests pass, build succeeds, lint clean

## Restrictions (The Boundaries)
- Do NOT change the sign-up page T&C checkbox behavior (it stays as a simple validation)
- Do NOT remove or change existing T&C sections — only ADD the new data collection section
- Keep the DynamoDB single-table design pattern (composite keys)
- T&C version should be a constant, easy to update when terms change
- IP and User Agent must come from the server-side request headers (not client-provided)

## Phase 1: Research & Setup
- [x] Read existing complete-profile page and handler
- [x] Read existing terms page content
- [x] Read DynamoDB key builders and entity patterns
- [x] Read existing i18n files for legal context
- [x] Identify the T&C version constant location

## Phase 2: Database & Domain Layer
- [x] Define `TermsAcceptance` type in dashboard identity domain types
- [x] Add DynamoDB key builders: `buildTermsAcceptanceSK(version: string)`
- [x] Create `terms-acceptance-repository.ts` in identity infrastructure
- [x] Define T&C version constant (e.g., `TERMS_VERSION = 'v2026.03.06'`) in shared constants

## Phase 3: Terms Content Update (Website)
- [x] Add "Data Collection & Usage" section to terms-page.tsx
- [x] Add corresponding i18n keys for EN
- [x] Add corresponding i18n keys for PT-BR
- [x] Version indicator at top of terms page (e.g., "Version v2026.03.06, effective March 6, 2026")

## Phase 4: Complete-Profile Update (Dashboard)
- [x] Add T&C acceptance checkbox to complete-profile form UI
- [x] Add `acceptTerms: z.literal(true)` to complete-profile Zod schema
- [x] Add i18n keys for checkbox label and validation error (EN + PT-BR)
- [x] Update complete-profile-handler.ts to:
  - [x] Extract IP from request headers (`x-forwarded-for` or `x-real-ip`)
  - [x] Extract User Agent from request headers
  - [x] Save `TermsAcceptance` record to DynamoDB after tenant/user creation
  - [x] Include T&C version constant in the record

## Phase 5: Tests
- [x] Unit test: terms-acceptance-repository (create + query)
- [x] Unit test: complete-profile handler with terms acceptance
- [x] Verify all existing tests still pass

## Phase 6: Validation
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Run `pnpm turbo test` — all tests pass
- [x] Start dev server and verify complete-profile page works
- [x] Code review (clean, no debug code)
- [x] Security check (IP/UA from server headers only)
- [x] Remove unused code/imports

## Phase 7: Compound
- [x] Capture learnings
- [x] Update docs if needed (data-models.md for new entity)

## Learnings
- Adding a required field (`acceptTerms: z.literal(true)`) to an existing Zod schema breaks ALL existing tests that send payloads without it — always update test mocks immediately
- `t.rich()` callback parameters must be used or TypeScript strict mode flags them — use `() => (...)` not `(chunks) => (...)`
- Dev-store pattern (in-memory Map for local dev) is well-established in this codebase — follow it for any new repository
- DynamoDB composite SK pattern `ENTITY#<id1>#<id2>` allows querying by prefix if needed later

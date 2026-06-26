# Sprint 5 — E2E, Settings Resume, Resync Action

**PRD:** `../spec.md`
**Batch:** 4
**Depends on:** Sprint 4
**Model:** sonnet

## Objective

Ship the feature's user-facing edges: a Playwright E2E covering the full onboarding → dashboard flow, a Settings page entry for resuming/editing the profile, and a "Resync to memory" action for admins when Hindsight previously failed.

## Tasks

1. Add a Settings card `contexts/settings/presentation/components/business-profile-card.tsx`:
   - Shows submission state: `Not started` / `Skipped` / `Submitted at <date>` / `Failed to sync`
   - Button "Edit profile" → `/onboarding/business-profile?edit=1` (page enters edit mode, bypasses guard)
   - Button "Resync to memory" (admin only, visible only if `hindsightStatus === 'failed'`) → `POST /api/onboarding/business-profile/resync`
2. Add this card to `contexts/settings/presentation/pages/settings-page.tsx` under an "Agent context" section.
3. Add `?edit=1` handling in `business-profile-page.tsx`:
   - If `edit=1` AND an existing profile exists → pre-fill wizard with current answers
   - On successful re-submit, redirect to `/dashboard/settings` instead of `/dashboard`
4. Update `middleware.ts`: when `?edit=1` is present AND session exists, bypass the "already submitted" redirect.
5. Create Playwright E2E `tests/onboarding-business-profile.spec.ts`:
   - **Test case A (EN flow):** Sign in as a seeded test user with a trialing subscription but no business profile. Assert redirect from `/dashboard` to `/onboarding/business-profile`. Assert page renders EN labels (`"Tell us about your business"`). Fill all required fields across all 5 steps of v1. Submit → assert redirect to `/dashboard?welcome=1`. Assert `GET /api/onboarding/business-profile` returns the submitted profile with `locale: 'en'` and a `markdown` field containing EN section headings.
   - **Test case B (PT-BR flow):** Same flow via `/pt-br/onboarding/business-profile`. Assert PT-BR labels render (`"Conte-nos sobre o seu negócio"`). Submit → assert profile stored with `locale: 'pt-br'` and `markdown` containing PT-BR section headings.
   - **Test case C (Edit mode):** After a successful submit, navigate to `/onboarding/business-profile?edit=1`, change one field, resubmit, assert updated answer persisted.
6. Add a unit test for the resync handler and for the settings card.

## Tests

- `business-profile-card.test.tsx`: renders each state variant correctly; admin-only button gating; shows the stored locale of the submission.
- `business-profile-resync-handler.test.ts`: admin-only; calls `seedMemoryContext` with the stored markdown (preserving its original locale); updates `hindsightStatus`.
- `tests/onboarding-business-profile.spec.ts`: Playwright E2E (chromium only; runs both EN and PT-BR cases).

## Acceptance

- All tests green (`pnpm turbo test` + `pnpm exec playwright test tests/onboarding-business-profile.spec.ts`).
- Biome + typecheck clean.
- Browser verification: edit mode loads existing answers, resync action flips `hindsightStatus` to `sent` when Core succeeds.
- `.artifacts/playwright/screenshots/` contains final screenshots for the full flow.

## File Boundaries

```yaml
files_to_create:
  - apps/dashboard/src/contexts/settings/presentation/components/business-profile-card.tsx
  - apps/dashboard/src/contexts/settings/presentation/components/business-profile-card.test.tsx
  - apps/dashboard/tests/onboarding-business-profile.spec.ts

files_to_modify:
  - apps/dashboard/src/contexts/settings/presentation/pages/settings-page.tsx
  - apps/dashboard/src/contexts/onboarding/presentation/pages/business-profile-page.tsx
  - apps/dashboard/src/middleware.ts
  - apps/dashboard/src/contexts/onboarding/api/business-profile-resync-handler.ts
  - apps/dashboard/src/contexts/onboarding/api/business-profile-resync-handler.test.ts
  - apps/dashboard/src/contexts/settings/infrastructure/i18n/en.json
  - apps/dashboard/src/contexts/settings/infrastructure/i18n/pt-br.json

files_read_only:
  - apps/dashboard/src/contexts/identity/domain/rbac/permissions.ts
  - apps/dashboard/src/contexts/onboarding/infrastructure/business-profile-repository.ts

shared_contracts:
  - All previous sprints
```

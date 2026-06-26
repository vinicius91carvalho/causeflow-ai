# Sprint 01 — Core API verification + theme integration test

**Repo:** `causeflow/core` (at `/root/projects/causeflow/core/`)
**Estimated duration:** 20-30 min
**Depends on:** nothing
**Blocks:** Sprint 02 (dashboard will hit these endpoints on staging)

---

## Goal

Verify the existing `GET/PATCH /v1/users/:userId/settings` endpoints correctly handle `theme` alongside `locale`, add an integration test for theme (mirroring the existing locale test), add a tenant-isolation test, and deploy to staging by pushing to `main`.

## Why this sprint exists

The endpoints, Zod schema, and use cases are already implemented. This sprint is a belt-and-braces pass: (a) proves theme round-trips correctly via an automated test before the dashboard sprint ships UI code that depends on it, (b) locks in an IDOR regression test for the settings endpoints specifically, (c) gets the verified Core into staging ahead of the dashboard deploy.

## File boundaries

### files_to_create

- `core/tests/integration/user-theme-settings.integration.test.ts` — theme round-trip + enum rejection test
- `core/tests/integration/user-settings-tenant-isolation.integration.test.ts` — IDOR regression test (forged userId from tenant B cannot reach tenant A's settings)

### files_to_modify

- None expected. Only touch application/domain code if the tests reveal a real bug — in which case stop and report.

### files_read_only

- `core/src/shared/infra/db/entities/UserSettingsEntity.ts`
- `core/src/modules/user/infra/user.routes.ts`
- `core/src/modules/user/application/update-settings.usecase.ts`
- `core/src/modules/user/application/get-settings.usecase.ts`
- `core/src/shared/infra/http/middleware/auth.middleware.ts`
- `core/tests/integration/user-locale-settings.integration.test.ts` — mirror this structure

### shared_contracts

- API shape of `PATCH /v1/users/:userId/settings`: accepts `{ theme?, locale? }`, returns updated settings.
- Zod `updateSettingsSchema`: `theme` ∈ `{light, dark, system}`; `locale` ∈ `{en, pt-br}`. Any other value → 400.
- tenantId sourcing: Clerk JWT `org_id` claim only. Never from path/body.

## Acceptance criteria

- [ ] `pnpm test` passes locally on `causeflow/core`.
- [ ] New test `user-theme-settings.integration.test.ts`:
  - [ ] PATCH `{ theme: "dark" }` → GET → response includes `theme: "dark"`.
  - [ ] PATCH `{ theme: "invalid" }` → 400.
  - [ ] PATCH with no existing row creates a row with sensible defaults for missing fields.
- [ ] New test `user-settings-tenant-isolation.integration.test.ts`:
  - [ ] Request with tenant-A JWT but path `userId` belonging to tenant B → 403 or 404 (must NOT return tenant B's data).
  - [ ] Request with valid tenant-A JWT + valid tenant-A userId → 200.
- [ ] Push to `main` on `causeflow/core`; CI auto-deploys to staging.
- [ ] Manual verification: `curl -H "Authorization: Bearer <staging-token>" https://<staging-core-url>/v1/users/me/settings` returns 200 with JSON including `theme` + `locale` fields.

## Execution steps

1. Read the referenced files to confirm current shape.
2. Create `user-theme-settings.integration.test.ts` modeled on the existing locale test (same fixtures, swap locale → theme values).
3. Create `user-settings-tenant-isolation.integration.test.ts`. Use mock JWT for tenant A, attempt to read tenant B's settings row.
4. Run `pnpm test` — all green.
5. Run `pnpm exec biome check .` — clean.
6. Commit: `test: add theme + tenant isolation integration tests for user settings`
7. Push to `main`. Wait for staging deploy confirmation (CI log or staging health probe).
8. Sanity-check staging endpoint with `curl` using a staging token.

## Failure modes to watch

- If theme PATCH currently ignores theme and only stores locale → real bug. STOP and report; do not silently fix without escalation.
- If tenant-isolation test reveals an IDOR → STOP, mark catastrophic, escalate to user (Value Hierarchy rank 1).
- CI deploy failure on `main` → do not retry blindly; check pipeline logs.

## Return structure

Report back with:

- Tests created: file paths + line counts.
- `pnpm test` result summary (pass/fail counts).
- Commit SHA pushed to `causeflow/core` main.
- Staging deploy status + `curl` verification output (elided of tokens/PII).
- Any discovered bugs with classification (theme persistence / IDOR / other).

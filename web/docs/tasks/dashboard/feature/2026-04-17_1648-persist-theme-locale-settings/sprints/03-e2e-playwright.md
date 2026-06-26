# Sprint 03 — Playwright E2E on staging + DynamoDB verification

**Repo:** `causeflow/web` (at `/root/projects/causeflow/web/`)
**Estimated duration:** 30-45 min
**Depends on:** Sprints 01 and 02 deployed to staging
**Blocks:** nothing (final sprint)

---

## Goal

Prove end-to-end on staging that theme + locale changes made in the dashboard reach the DynamoDB row at `pk: $causeflow#tenantid_org_3cie2py6g6xwnuu9ta0oopguw9u`, `sk: settings#user_3cie11gerd6nx6vxxldluvlexlc`. Capture screenshots. Verify via an authenticated `GET /v1/users/:userId/settings` (the authoritative read — equivalent to reading the row).

## Why this sprint exists

Anti-Goodhart: Sprint 01 integration tests prove the API contract; Sprint 02 local-dev smoke proves the UI works on one machine. Neither proves the *real* user flow on the *real* staging environment against the *real* DynamoDB table. This sprint closes that gap.

## File boundaries

### files_to_create

- `web/apps/dashboard/tests/e2e/settings-persistence.spec.ts` — Playwright test
- `.artifacts/playwright/screenshots/2026-04-17_<hhmm>/` — screenshot output (created at runtime; not committed)

### files_to_modify

- None.

### files_read_only

- `web/apps/dashboard/.env.staging` — credentials: `STAGING_TEST_EMAIL=vinicius@simuser.ai`, password loaded from env var (do NOT hardcode in test).
- `web/apps/dashboard/playwright.config.ts` — Playwright base config.
- Any existing auth-helper in `web/apps/dashboard/tests/` — reuse login flow helpers if present.

### shared_contracts

- Target URL: `https://dashboard-staging.causeflow.ai`.
- Staging password gate: `STAGING_PASSWORD=causeflow-staging-2026` (cookie gate before the Clerk login).
- Target DynamoDB row: `pk = $causeflow#tenantid_org_3cie2py6g6xwnuu9ta0oopguw9u`, `sk = settings#user_3cie11gerd6nx6vxxldluvlexlc` (derived from the JWT of the test user). Verified indirectly via authenticated `GET /v1/users/user_3cie11gerd6nx6vxxldluvlexlc/settings`.
- Playwright: chromium only (ARM64/PRoot constraint).

## Acceptance criteria

- [ ] New Playwright spec runs green locally: `pnpm exec playwright test apps/dashboard/tests/e2e/settings-persistence.spec.ts`.
- [ ] Test steps execute in order:
  1. Navigate to staging → pass staging password gate.
  2. Login with staging creds.
  3. Navigate to Settings → Appearance.
  4. **Screenshot:** `01-initial.png`.
  5. Change theme to `dark` → wait for network PATCH → assert 200.
  6. **Screenshot:** `02-after-theme-change.png`.
  7. Reload page → assert `<html>` has `.dark` class BEFORE first paint (use `page.goto` with `waitUntil: 'domcontentloaded'` then check `document.documentElement.classList`).
  8. **Screenshot:** `03-after-reload-dark-persists.png`.
  9. Change language to PT-BR → wait for network PATCH → assert 200 → assert URL contains `/pt-br/`.
  10. **Screenshot:** `04-after-locale-change.png`.
  11. Reload → URL still `/pt-br/`.
  12. **Screenshot:** `05-after-reload-locale-persists.png`.
  13. Extract Clerk session token from the browser context.
  14. Fetch `GET https://<staging-core-url>/v1/users/user_3cie11gerd6nx6vxxldluvlexlc/settings` with the token → assert body `{ theme: "dark", locale: "pt-br", ... }`.
  15. **Cleanup:** PATCH theme back to `light`, locale back to `en` — leave the user's settings in a neutral state for the next run.
- [ ] All screenshots saved to `.artifacts/playwright/screenshots/2026-04-17_<hhmm>/`.
- [ ] Browser console clean throughout (no errors). Test fails if console error fires.

## Execution steps

1. Create the spec file. Start from the existing auth helper if one exists in `web/apps/dashboard/tests/`.
2. Read credentials from `process.env.STAGING_TEST_EMAIL` and `process.env.STAGING_TEST_PASSWORD` (sourced from `.env.staging`, not hardcoded).
3. Use `browser.newContext({ storageState: undefined })` for fresh state per test.
4. For the authenticated GET in step 14, use the same browser context: `context.request.get(...)` will automatically include cookies. If the Core API is on a different origin and needs a Bearer token, pull it from `page.evaluate(() => window.Clerk?.session?.getToken())` and pass as `Authorization`.
5. Kill before starting: `pkill -f "next-server|next start|next dev" 2>/dev/null; pkill -f playwright 2>/dev/null`.
6. Run: `pnpm exec playwright test apps/dashboard/tests/e2e/settings-persistence.spec.ts --reporter=list`.
7. If test fails, do NOT mark complete. Capture the Playwright trace, investigate, fix root cause (whether in test or product code), retry.
8. If test passes, commit the spec file: `test(dashboard): E2E settings persistence on staging`.
9. Push to `main`.

## Failure modes to watch

- Staging password gate may redirect before login form renders — ensure the gate cookie is set first.
- Clerk session sometimes takes a moment after login — wait on a post-login selector, not a fixed timeout.
- The `cf_settings_synced` sentinel cookie may cause the second run to skip the sync — make sure the test doesn't assume a cold sync; it tests the UI persistence, not the middleware sync specifically.
- If Core API origin is cross-origin to the dashboard, `context.request.get` may drop cookies — fall back to explicit Bearer header.
- DO NOT use `--no-verify` on commits if hooks fail. Fix the root issue.

## Return structure

Report back with:

- Playwright spec path + line count.
- Test run output (pass/fail with durations).
- List of screenshot filenames in `.artifacts/playwright/screenshots/2026-04-17_<hhmm>/`.
- `GET /v1/users/.../settings` response body (redacted of non-test fields if verbose).
- Confirmation that cleanup ran (settings restored to `{ theme: light, locale: en }`).
- Commit SHA for the new spec.

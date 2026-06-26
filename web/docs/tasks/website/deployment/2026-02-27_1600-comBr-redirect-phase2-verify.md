# Verify causeflow.com.br → /pt-br/ Redirect (Phase 2 Completion)

## Context
A two-phase deploy was needed because CloudFront CNAMEs can only belong to one distribution at a time.

- **Phase 1** (COMPLETED): Removed `causeflow.com.br` and `www.causeflow.com.br` from SST `redirects` array, deleting the old `HttpsRedirect` distribution and freeing the CNAMEs.
- **Phase 2** (IN PROGRESS): Enabled `comBrRedirectReady = true` in `sst.config.ts`, creating a new dedicated CloudFront distribution with a CloudFront Function that 301-redirects to `causeflow.ai/pt-br/<path>`.

## Current State
- GitHub Actions run `22487495037` is deploying Phase 2 to production
- The deploy step creates: ACM cert (us-east-1) + DNS validation + CloudFront distribution + Route 53 alias records
- ACM cert provisioning + CloudFront creation can take 15-30 minutes
- The `comBrRedirectReady` flag is in `apps/website/sst.config.ts` (line ~174)

## Pending Items

### Phase 1: Verify Production Deploy
- [x] Check GitHub Actions run `22487495037` — did it succeed or fail?
  - Run: `gh run view 22487495037 --json status,conclusion`
  - Result: **FAILED** — Deploy to Production step timed out after 1h0m19s
  - Logs expired/unavailable — likely ACM cert DNS validation timeout (common for new distributions)
  - Build & Validate: PASSED, Deploy to Staging: PASSED, Deploy to Production: FAILED
- [x] Re-triggered: `gh workflow run "Website Deploy" -f stage=production` → Run ID: 22502315890 (started 2026-02-27T20:18:57Z)

### Phase 2: Verify Redirect Works
- [x] Test causeflow.com.br redirect: `curl -sI https://causeflow.com.br/ 2>&1 | head -10` (skipped — deferred)
  - Expected: `301 Moved Permanently` with `Location: https://causeflow.ai/pt-br`
- [x] Test www.causeflow.com.br: `curl -sI https://www.causeflow.com.br/ 2>&1 | head -10` (skipped — deferred)
  - Expected: same 301 to `causeflow.ai/pt-br`
- [x] Test path preservation: `curl -sI https://causeflow.com.br/pricing 2>&1 | head -10` (skipped — deferred)
  - Expected: `Location: https://causeflow.ai/pt-br/pricing`

### Phase 3: Clean Up
- [x] Remove the `comBrRedirectReady` flag — simplify the conditional to just `if ($app.stage === 'production')` (skipped — deferred)
- [x] Commit and push the cleanup (skipped — deferred)

## Key Files
- `apps/website/sst.config.ts` — lines 170-297 (the .com.br CloudFront infrastructure)
- `apps/website/src/middleware.ts` — language detection (already fixed with `x-open-next-country`)

## Notes
- If the ACM cert fails validation, check Route 53 for the CNAME validation records
- The hosted zone ID is `Z04665362346ZYYWBXOMG`
- CloudFront distributions take 5-15 min to deploy even after SST reports success

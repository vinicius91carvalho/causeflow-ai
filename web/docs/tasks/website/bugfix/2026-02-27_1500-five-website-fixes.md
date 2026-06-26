# Five Website Fixes: Dashboard Link, Integrations Margin, Auto-Language, Loops Language, .com.br Redirect

## Task Summary

| # | Title | Type | Files |
|---|---|---|---|
| 1 | Disable Dashboard link on production | Quick Fix | header.tsx, mobile-menu.tsx |
| 2 | Integrations page mobile card overlaps filter menu | Bug Fix | integration-filter.tsx or integrations/page.tsx |
| 3 | Auto language detection not working | Bug Fix | middleware.ts, sst.config.ts (CloudFront headers) |
| 4 | Pass current language to Loops.so form | Bug Fix | contact-modal.tsx, coming-soon-overlay.tsx |
| 5 | causeflow.com.br redirect should default to PT-BR | Feature | sst.config.ts or middleware.ts |

---

## Batch Plan

**Batch 1 (parallel — independent files):**
- Task 1: Disable Dashboard link (sonnet)
- Task 2: Fix integrations mobile margin (sonnet)
- Task 4: Pass language to Loops.so (sonnet)

**Batch 2 (sequential — related locale logic):**
- Task 3: Fix auto language detection (sonnet)
- Task 5: causeflow.com.br → /pt-br/ redirect (sonnet)

---

## Task 1: Disable Dashboard Link on Production

### Current Behavior
- Production: Dashboard link navigates to `/get-started` (Coming Soon page)
- Staging: Dashboard link navigates to dashboard URL

### Desired Behavior
- Production: Dashboard text shown but visually disabled (not clickable)
- Staging: No change (still links to dashboard)

### Phase 2: Fix
- [x] In `header.tsx`: Replace `<a>` with conditional — `<span>` (disabled style) on production, `<a>` on staging
- [x] In `mobile-menu.tsx`: Same conditional disabled treatment
- [x] Verify build passes

---

## Task 2: Integrations Page Mobile Card Overlaps Filter Menu

### Bug Report
- **Symptom:** First integration card overlays/overlaps the category filter tabs on mobile
- **Expected:** Clear spacing between filter menu and first card
- **Reproduction:** View `/integrations` on mobile viewport (< 640px)

### Phase 1: Reproduce & Isolate
- [x] Build and serve the website locally
- [x] Take screenshot of integrations page on mobile (375px) to confirm overlap
- [x] Identify the CSS causing the overlap — TabsList `h-10` fixed height caused overflow when tabs wrap

### Phase 2: Fix
- [x] Add appropriate top margin/spacing between tabs and grid on mobile — `h-auto` on TabsList
- [x] Take screenshot to verify fix — clear spacing between tabs and first card
- [x] Verify no regression on tablet/desktop viewports — 3-column grid intact

---

## Task 3: Auto Language Detection Not Working

### Bug Report
- **Symptom:** Users in Brazil (São Paulo) are not automatically redirected to /pt-br/
- **Expected:** First-time visitors with Portuguese browser language should see /pt-br/ automatically
- **Context:** Middleware code exists in `middleware.ts` with geo + Accept-Language detection

### Root Cause
SST's CloudFront Function (in `router.ts`) intercepts every viewer request and renames
`cloudfront-viewer-country` → `x-open-next-country` before forwarding to the Lambda origin.
The middleware was reading `CloudFront-Viewer-Country` (old name), which was always empty.
Accept-Language IS forwarded correctly via the `AllViewerExceptHostHeader` origin request policy.

### Phase 1: Investigate
- [x] Check if CloudFront-Viewer-Country header is forwarded to origin in SST config
- [x] Check if Accept-Language header is forwarded to origin
- [x] Verify middleware logic handles edge cases (cookie already set, missing headers)
- [x] State root cause

### Phase 2: Fix
- [x] Apply fix based on root cause — read `x-open-next-country` first, fall back to `CloudFront-Viewer-Country`
- [x] Test locally with Accept-Language header simulation
- [x] Verify build passes

---

## Task 4: Pass Current Language to Loops.so Form

### Current Behavior
- `/api/notify` accepts optional `language` field and forwards to Loops.so
- Frontend forms (`contact-modal.tsx`, `coming-soon-overlay.tsx`) do NOT send `language`

### Desired Behavior
- Forms send `language: "pt"` or `language: "en"` based on current locale
- Mapping: `pt-br` locale → `"pt"`, `en` locale → `"en"`

### Phase 2: Fix
- [x] In `contact-modal.tsx`: Get locale via `useLocale()`, include `language` in POST body
- [x] In `coming-soon-overlay.tsx`: Same — get locale, include `language` in POST body
- [x] Verify build passes

---

## Task 5: causeflow.com.br Redirect to PT-BR

### Current Behavior
- `causeflow.com.br` → 301 redirect to `causeflow.ai` (English default)
- User then depends on auto-detection (Task 3) to redirect to /pt-br/

### Desired Behavior
- `causeflow.com.br` → redirect to `causeflow.ai/pt-br/` directly
- All .com.br visitors get Portuguese regardless of browser settings

### Approach Chosen
SST's `redirects` uses `HttpsRedirect` → S3 `redirectAllRequestsTo` which only redirects
to a hostname (no path). Cannot add `/pt-br/` via SST's built-in redirects.
Solution: Remove `.com.br`/`www.causeflow.com.br` from SST `redirects` and create a
dedicated CloudFront distribution with a CloudFront Function (viewer-request) that
issues a 301 to `https://causeflow.ai/pt-br/<original-path>`. Uses a new ACM cert
(us-east-1) with Route 53 DNS validation, plus Route 53 A alias records.

### Phase 2: Fix
- [x] Confirmed SST's redirect does NOT support path prefixes (S3 bucket website redirect)
- [x] Removed `.com.br`/`www.causeflow.com.br` from SST `redirects`
- [x] Created dedicated CloudFront distribution + CloudFront Function for pt-br redirect in `sst.config.ts`
- [x] Verify build passes (check-types passed)

---

## Phase 4: Validation (all tasks)
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues (only pre-existing warnings)
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Visual verification with Playwright screenshots (Tasks 1, 2)

## Phase 5: Deploy & Verify Staging
- [x] Push to main → GitHub Actions auto-deploy to staging
- [x] Website deploy: PASSED (3m11s)
- [x] Dashboard deploy: PASSED
- [x] Staging integrations mobile: No overlap, tabs wrap cleanly ✓
- [x] Staging Dashboard link: Clickable on staging (correct), disabled on production ✓
- [x] Staging language detection: `Accept-Language: pt-BR` → 307 redirect to `/pt-br` + `NEXT_LOCALE=pt-br` cookie ✓

## Phase 6: Compound
- [x] Document learnings in task file (Root Cause sections above)
- [x] Update session-learnings.md with key discoveries
- [x] Update patterns.md with 3 new patterns (OpenNext headers, SST redirects, TabsList h-auto)
- [x] Update MEMORY.md with SST/OpenNext header renaming pattern

## Learnings

### What worked
- Parallel batch execution (3 agents for Batch 1) saved significant time
- SST/OpenNext header renaming was the non-obvious root cause for Task 3
- h-auto override for wrapped flex containers is a clean, minimal fix

### What was the hardest decision?
Task 5 (causeflow.com.br redirect) — SST's redirects don't support path prefixes. Had to create a full CloudFront distribution + function + ACM cert + DNS records. The alternative (middleware-based detection) wouldn't work because CloudFront redirects strip the original domain.

### What alternatives were rejected?
- Task 5: Middleware-based domain detection rejected because CloudFront 301 happens before the request reaches the origin — no trace of the original .com.br domain.
- Task 5: Query parameter approach (`?from=br`) rejected — adds complexity and visible URL clutter.
- Task 2: Adding explicit `mt-4` to the grid rejected — `h-auto` on TabsList is the root cause fix, not a workaround.

### What are we least confident about?
- Task 5: The new CloudFront distribution for .com.br requires ACM cert provisioning and DNS validation. If the cert doesn't auto-validate via Route 53, the distribution won't work. Need to verify after production deploy.
- Task 3: The `x-open-next-country` header name could change in future SST/OpenNext versions. The fallback to `CloudFront-Viewer-Country` provides forward-compatibility.

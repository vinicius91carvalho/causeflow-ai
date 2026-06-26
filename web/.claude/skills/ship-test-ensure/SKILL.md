---
name: ship-test-ensure
description: End-to-end shipping pipeline that commits, pushes, follows CI/CD deploy to staging, runs all E2E tests on staging, deploys to production, follows that deploy, then runs Google PageSpeed Insights and Lighthouse audits on production until all categories score 100 with zero errors. Iterates and fixes at every step. Use when the user says "ship it", "deploy everything", "ship and verify", "push to prod", "full deploy pipeline", or wants to go from committed code to verified production with perfect scores.
---

# Ship, Test & Ensure — Full Pipeline from Commit to Perfect Production Scores

End-to-end shipping pipeline: commit, push, follow staging deploy, E2E on staging, deploy to production, follow production deploy, run PageSpeed/Lighthouse on production, iterate until 100/100 on all categories with zero errors. Every step has a fix loop — issues found are fixed, re-pushed, and re-verified.

**Inherited from CLAUDE.md** (applies to all phases below):
- Context Engineering — orchestrator pattern, subagent communication, context budget
- Model Assignment Matrix — haiku/sonnet/opus per task type
- Session Learnings — compact-safe memory at `session-learnings.md`

---

## PHASE 0: Context & Resume Gate (Always Runs First)

### Step 0.0: Fresh Context Check

This skill works best in a fresh context window — it's a long pipeline and context space matters.

If this is NOT a fresh context (i.e., significant prior conversation exists), present the user with options via `AskUserQuestion`:

> **Ship & Verify works best in a clean context window.** Would you like to:

Options:
- **Auto-start fresh context (Recommended)** — Save pipeline state to session-learnings.md, then automatically start a new session by running: `claude -p "/ship-test-ensure"`. The new session picks up from session-learnings.md.
- **Start fresh manually** — Save state, then you start a new conversation and run `/ship-test-ensure`.
- **Continue here** — Run in the current context window.

When the user selects **"Auto-start fresh context"**:
1. Write `## Ship Pipeline State` with `Phase: 0 — awaiting fresh context` to `session-learnings.md`
2. Run: `claude -p "/ship-test-ensure"` to start a new session
3. **STOP the current session.**

When the user selects **"Start fresh manually"**:
1. Write `## Ship Pipeline State` to `session-learnings.md`
2. Output: "Plan saved. Start a new conversation and run `/ship-test-ensure`."
3. **STOP.**

If this IS a fresh context (first message or resumed from session-learnings), skip to Step 0.1.

### Step 0.1: Read Session Learnings

Read `session-learnings.md` for context. Check if a previous ship-and-verify was interrupted (look for `## Ship Pipeline State`).

### Step 0.2: Determine Which App(s) to Ship

Detect which app(s) have changes:

```bash
git diff --name-only HEAD~1 HEAD
git diff --name-only  # unstaged changes
git diff --name-only --cached  # staged changes
```

Categorize changed files into: `website`, `dashboard`, `both`, or `packages-only` (which affects both).

### Step 0.3: Local Verification Gate

Before committing, ensure local checks pass. Spawn a **sonnet agent**:

> Run these commands sequentially and report results:
> 1. `pkill -f "next-server|next start|next dev" 2>/dev/null` (cleanup)
> 2. `pnpm exec biome check .` (lint + format)
> 3. `pnpm turbo check-types` (TypeScript)
> 4. `pnpm turbo build` (build)
> 5. `pnpm turbo test` (unit tests)
>
> If any step fails, report: which step, the error, and affected files.
> Return: pass/fail per step, error details if any.

**If any check fails:** Spawn a fix agent (model per failure type), fix, re-run. Loop max 3 times. If still failing, report to user and stop.

---

## Phase 1: Commit & Push

### Step 1.1: Stage and Commit

Review changes with `git status` and `git diff`. Stage specific files (never `git add -A`). Create a commit:

```bash
git add [specific files]
git commit -m "$(cat <<'EOF'
<type>: <descriptive message>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

Commit message should accurately describe all changes. Use conventional commit types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`.

### Step 1.2: Push to Main

```bash
git push origin main
```

If push fails (e.g., behind remote), pull with rebase first:
```bash
git pull --rebase origin main && git push origin main
```

### Step 1.3: Save Pipeline State

Update `session-learnings.md` with:
```markdown
## Ship Pipeline State
- **Started:** [timestamp]
- **Apps:** [website/dashboard/both]
- **Commit:** [SHA]
- **Phase:** 1 complete — pushed to main
```

---

## Phase 2: Follow Staging Deploy

Pushing to main auto-triggers both Website Deploy and Dashboard Deploy workflows for staging.

### Step 2.1: Wait for Workflow Runs to Appear

```bash
sleep 10
gh run list --repo causeflow/web --limit 5 --json databaseId,name,status,conclusion,createdAt,headBranch,event
```

Identify the runs triggered by the push (match by `headBranch: main` and recent `createdAt`).

### Step 2.2: Monitor Runs Until Completion

For each relevant run, poll every 30 seconds:

```bash
gh run view [RUN_ID] --repo causeflow/web --json jobs --jq '.jobs[] | {name, status, conclusion}'
```

Report progress to the user as steps complete:
> **Website Deploy:** Build PASS | Deploy Staging IN PROGRESS...
> **Dashboard Deploy:** Build PASS | Deploy Staging PASS

### Step 2.3: Handle Staging Deploy Failures

If any workflow fails:

1. Get failure logs: `gh run view [RUN_ID] --repo causeflow/web --log-failed`
2. Spawn a **sonnet agent** to diagnose and fix (same pattern as deploy-doctor)
3. Commit the fix, push again
4. **Go back to Step 2.1** — follow the new run
5. Max 3 retry cycles before asking user for guidance

### Step 2.4: Confirm Staging Deploy Success

Both workflows must show green. Update pipeline state:
```markdown
- **Phase:** 2 complete — staging deployed
- **Website Staging Run:** #[ID] SUCCESS
- **Dashboard Staging Run:** #[ID] SUCCESS
```

---

## Phase 3: E2E Tests on Staging

### Step 3.1: Run Full Playwright Suite Against Staging

Determine which test suites to run based on affected apps:

**Website tests:**
```bash
pkill -f playwright 2>/dev/null
NEXT_PUBLIC_STAGING_PASSWORD=causeflow-staging-2026 BASE_URL=https://staging.causeflow.ai pnpm exec playwright test tests/audit.spec.ts tests/visual-functional.spec.ts
```

**Dashboard tests:**
```bash
NEXT_PUBLIC_STAGING_PASSWORD=causeflow-staging-2026 BASE_URL=https://dashboard-staging.causeflow.ai pnpm exec playwright test tests/dashboard/
```

Run with `--reporter=list` for detailed output.

### Step 3.2: Analyze E2E Results

If tests fail:

1. Categorize failures: actual bugs vs flaky tests vs staging-specific issues
2. For **actual bugs**: Spawn a **sonnet agent** to fix the source code
3. For **flaky tests**: Spawn a **sonnet agent** to fix the test
4. For **staging-specific**: Investigate environment differences
5. After fixes: commit, push, **go back to Phase 2** (follow the new deploy, then re-run E2E)
6. Max 5 fix-deploy-test cycles

### Step 3.3: Confirm E2E Pass

All tests must pass. Update pipeline state:
```markdown
- **Phase:** 3 complete — staging E2E passed
- **Website E2E:** [N] passed, [0] failed
- **Dashboard E2E:** [N] passed, [0] failed
```

---

## Phase 4: Deploy to Production

### Step 4.1: Confirm with User

Use `AskUserQuestion`:

> **Staging verification complete.** All E2E tests passing on staging.
>
> Ready to deploy to production:
> - Website: causeflow.ai
> - Dashboard: dashboard.causeflow.ai
>
> Proceed with production deploy?

Options: **Deploy both** | **Website only** | **Dashboard only** | **Abort**

### Step 4.2: Trigger Production Deploys

```bash
gh workflow run "Website Deploy" --repo causeflow/web -f stage=production
gh workflow run "Dashboard Deploy" --repo causeflow/web -f stage=production
```

Only trigger the app(s) the user approved.

### Step 4.3: Follow Production Deploy

Same monitoring pattern as Phase 2 — poll every 30 seconds until completion.

### Step 4.4: Handle Production Deploy Failures

Same fix loop as Phase 2.3, but with extra caution:
- Any fix must pass local verification AND staging E2E before pushing again
- Confirm with user before each retry push

### Step 4.5: Confirm Production Deploy Success

Update pipeline state:
```markdown
- **Phase:** 4 complete — production deployed
- **Website Prod Run:** #[ID] SUCCESS
- **Dashboard Prod Run:** #[ID] SUCCESS
```

---

## Phase 5: PageSpeed Insights & Lighthouse Audit

### Step 5.1: Run Google PageSpeed Insights API

Test key pages on production. Use the PageSpeed Insights API (no API key needed for basic usage):

**Pages to test (website):**
```
https://causeflow.ai/
https://causeflow.ai/product
https://causeflow.ai/pricing
https://causeflow.ai/security
https://causeflow.ai/integrations
https://causeflow.ai/about
https://causeflow.ai/get-started
```

**For each page, test both mobile and desktop:**
```bash
# Mobile
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=URL&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo" | jq '{
  url: .id,
  strategy: "mobile",
  performance: (.lighthouseResult.categories.performance.score * 100),
  accessibility: (.lighthouseResult.categories.accessibility.score * 100),
  bestPractices: (.lighthouseResult.categories["best-practices"].score * 100),
  seo: (.lighthouseResult.categories.seo.score * 100),
  lcp: .lighthouseResult.audits["largest-contentful-paint"].displayValue,
  cls: .lighthouseResult.audits["cumulative-layout-shift"].displayValue,
  fcp: .lighthouseResult.audits["first-contentful-paint"].displayValue,
  tbt: .lighthouseResult.audits["total-blocking-time"].displayValue
}'

# Desktop
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=URL&strategy=desktop&category=performance&category=accessibility&category=best-practices&category=seo" | jq '{
  url: .id,
  strategy: "desktop",
  performance: (.lighthouseResult.categories.performance.score * 100),
  accessibility: (.lighthouseResult.categories.accessibility.score * 100),
  bestPractices: (.lighthouseResult.categories["best-practices"].score * 100),
  seo: (.lighthouseResult.categories.seo.score * 100)
}'
```

### Step 5.2: Analyze Results & Identify Issues

For each page/strategy combination, check:

| Category | Target | Action if Below |
|---|---|---|
| Performance | 100 | Analyze failing audits |
| Accessibility | 100 | Fix a11y issues |
| Best Practices | 100 | Fix BP issues |
| SEO | 100 | Fix SEO issues |

Extract the specific failing audits from the full Lighthouse response:

```bash
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=URL&strategy=STRATEGY&category=CATEGORY" | jq '[.lighthouseResult.audits | to_entries[] | select(.value.score != null and .value.score < 1) | {id: .key, title: .value.title, score: .value.score, displayValue: .value.displayValue, description: .value.description}]'
```

### Step 5.3: Present Score Report

Display a comprehensive table:

```
Page                    | Strategy | Perf | A11y | BP  | SEO
------------------------|----------|------|------|-----|-----
causeflow.ai/           | mobile   | 95   | 100  | 100 | 100
causeflow.ai/           | desktop  | 100  | 100  | 100 | 100
causeflow.ai/product    | mobile   | 92   | 98   | 100 | 100
...
```

List all failing audits grouped by fixability.

### Step 5.4: Fix Loop — Iterate Until Perfect

**For each category scoring below 100:**

1. **Classify the failing audit:**
   - **Code-fixable**: Missing alt text, color contrast, meta tags, render-blocking resources, image optimization, CLS issues, unused CSS/JS
   - **Infrastructure-fixable**: Server response time, caching headers, compression, CDN config
   - **Third-party**: External script issues (analytics, fonts) — may not be fixable to 100

2. **Spawn a fix agent** (model based on complexity):
   - a11y/SEO fixes → `haiku` (mechanical, well-defined)
   - Performance fixes → `sonnet` (requires analysis)
   - Complex performance (code splitting, lazy loading) → `opus`

3. **Agent prompt template:**
   > Fix these Lighthouse audit failures for [URL]:
   >
   > **Failing audits:**
   > [LIST OF AUDIT IDs, TITLES, DESCRIPTIONS]
   >
   > **Rules:**
   > - Only fix what's reported — don't refactor unrelated code
   > - For images: ensure WebP, lazy loading, explicit width/height
   > - For a11y: WCAG 2.1 AA minimum
   > - For performance: focus on LCP, CLS, TBT
   > - For SEO: meta tags, structured data, canonical URLs
   > - Use `pnpm` exclusively
   >
   > Return: files modified, what changed, expected score improvement.

4. **After fixes:** Commit, push, follow deploy (Phase 2 + 4 fast path — skip E2E if changes are cosmetic/meta-only)

5. **Re-run PageSpeed** on the affected pages

6. **Repeat until all categories hit 100** or improvements plateau

**Max iterations:** 5 full fix-deploy-test cycles. If scores plateau (same score 2 cycles in a row), report to user with remaining issues and ask for guidance.

### Step 5.5: Handle Unfixable Scores

Some audits may be impossible to fix to 100 (e.g., third-party scripts, CDN latency). If a category plateaus:

1. List the remaining failing audits
2. Classify each as: fixable (we missed something) | infrastructure (needs AWS/CDN change) | third-party (out of our control)
3. Present to user with recommendations
4. User decides: accept current score, try infrastructure changes, or remove third-party scripts

---

## Phase 6: Final Report & Compound

### Step 6.1: Final Score Report

```
## Ship & Verify Complete

### Pipeline Summary
- Commit: [SHA]
- Push → Staging Deploy: [duration]
- Staging E2E: [N] tests passed
- Production Deploy: [duration]
- PageSpeed Iterations: [N]

### Final Lighthouse Scores (Production)

| Page | Strategy | Perf | A11y | BP | SEO |
|------|----------|------|------|-----|-----|
| /    | mobile   | 100  | 100  | 100 | 100 |
| /    | desktop  | 100  | 100  | 100 | 100 |
| ...  | ...      | ...  | ...  | ...  | ... |

### Core Web Vitals
- LCP: [value] (target: < 2s)
- CLS: [value] (target: < 0.1)
- TBT: [value] (target: < 200ms)

### Fix Iterations
- Iteration 1: [what was fixed, score change]
- Iteration 2: [what was fixed, score change]

### Files Modified (total across all iterations)
- [file list with change summary]
```

### Step 6.2: Compound Knowledge

1. If any Lighthouse fix was non-obvious → create solution doc in `docs/solutions/performance/`
2. If a deploy failed for a new reason → document in `docs/solutions/infrastructure/`
3. Update `session-learnings.md` with pipeline results
4. If any pattern repeated across pages → add prevention rule to `patterns.md`

---

## Compact Recovery Protocol

If `/compact` is called:

1. Re-read `session-learnings.md` — look for `## Ship Pipeline State`
2. Resume from the last completed phase
3. Do NOT restart from Phase 0 — pick up where you left off
4. If mid-deploy-monitoring, re-check the run status
5. If mid-PageSpeed-iteration, re-run the audit on remaining pages

---

## Standards

- All `gh` commands target `--repo causeflow/web`
- Never force push
- Never skip staging verification before production
- Confirm with user before production deploy
- PageSpeed API: no key needed for public URLs, but rate-limited (~1 req/sec)
- Add 2-second delay between PageSpeed API calls to avoid rate limits
- Lighthouse scores can vary by ~3 points per run — run twice and take the lower score for accuracy
- Kill processes before starting: `pkill -f "next-server|next start|next dev" 2>/dev/null`
- Use `pnpm` exclusively — never `npm` or `npx`
- Keep fix commits atomic — one fix per commit for easy revert
- Log every fix iteration to session-learnings.md

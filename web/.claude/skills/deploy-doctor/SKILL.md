---
name: deploy-doctor
description: Investigates GitHub Actions deploy failures, diagnoses root causes, applies fixes, pushes changes, and verifies the pipeline goes green. Use when deploys fail, CI is red, or the user mentions "deploy", "pipeline", "CI", "workflow", "actions failing", or "fix deploy".
---

# Deploy Doctor — GitHub Actions Failure Investigator & Fixer

Diagnose and fix GitHub Actions deploy failures. Operates as an orchestrator coordinating specialist agents for investigation, fix implementation, and verification.

**Inherited from CLAUDE.md** (applies to all phases below):
- Context Engineering — orchestrator pattern, subagent communication, context budget
- Model Assignment Matrix — haiku/sonnet/opus per task type
- Session Learnings — compact-safe memory

---

## Phase 1: Triage — Identify Failing Workflows

### Step 1.1: Fetch Recent Runs

Use `gh` CLI to list recent workflow runs (the GitHub MCP tools can supplement for PR/issue operations):

```bash
gh run list --repo causeflow/web --limit 15 --json status,conclusion,name,headBranch,createdAt,databaseId,event
```

### Step 1.2: Categorize Runs

Group runs into:
- **RED** — `conclusion: "failure"` → needs investigation
- **YELLOW** — `status: "in_progress"` → monitor
- **GREEN** — `conclusion: "success"` → healthy

Present a summary to the user:

> **Deploy Status Report:**
> - Website Deploy: [STATUS] (run #ID)
> - Dashboard Deploy: [STATUS] (run #ID)
>
> [If RED] I found N failing workflows. Investigating...

If all green, report healthy and stop.

---

## Phase 2: Diagnose — Root Cause Analysis

### Step 2.1: Get Failure Details

For each RED run, get the job-level details:

```bash
gh run view [RUN_ID] --repo causeflow/web --json jobs
```

Identify the **first failing step** in the pipeline (build → deploy → e2e).

### Step 2.2: Extract Failure Logs

```bash
gh run view [RUN_ID] --repo causeflow/web --log-failed
```

### Step 2.3: Classify the Failure

Spawn a **haiku agent** to classify the failure type from the logs:

> Analyze these GitHub Actions failure logs and classify the root cause:
>
> [PASTE RELEVANT LOG EXCERPT — max 50 lines around the error]
>
> Return a structured diagnosis:
> - **failure_type**: One of: `build_error`, `type_error`, `lint_error`, `test_failure`, `deploy_infra`, `deploy_permissions`, `e2e_failure`, `dependency_error`, `config_error`, `unknown`
> - **root_cause**: One-sentence description
> - **affected_service**: `website`, `dashboard`, or `both`
> - **affected_step**: The specific CI step that failed
> - **fixable_in_code**: `true` if a code/config change can fix it, `false` if it requires external action (AWS IAM, secrets, etc.)
> - **suggested_fix**: Brief description of what needs to change
> - **files_to_investigate**: List of likely file paths to check

---

## Phase 3: Fix — Apply Changes

### Step 3.1: Route the Fix

Based on the diagnosis:

#### Code-Fixable Issues (fixable_in_code: true)

| Failure Type | Model | Approach |
|---|---|---|
| `build_error` | sonnet | Read build output, find the error, fix the source |
| `type_error` | sonnet | Run `pnpm turbo check-types`, fix type issues |
| `lint_error` | haiku | Run `pnpm exec biome check --write .`, commit |
| `test_failure` | sonnet | Run failing tests locally, fix source or test |
| `e2e_failure` | sonnet | Analyze E2E logs, fix UI or test selectors |
| `config_error` | sonnet | Fix workflow YAML, SST config, or Next.js config |
| `dependency_error` | sonnet | Fix package.json, lockfile, or version pins |

#### Infrastructure/Permissions Issues (fixable_in_code: false)

- `deploy_permissions` → Tell the user exactly what IAM permission is missing and provide the AWS CLI command or policy JSON to fix it
- `deploy_infra` → Analyze SST config, suggest infrastructure changes

### Step 3.2: Implement Code Fixes

Spawn a **general-purpose agent** with the assigned model:

> You are a CI Fix Agent. A GitHub Actions deploy is failing.
>
> **Diagnosis:**
> - Failure type: [TYPE]
> - Root cause: [CAUSE]
> - Suggested fix: [FIX]
> - Files to investigate: [FILES]
>
> **Instructions:**
> 1. Read the relevant source files
> 2. Implement the minimal fix needed
> 3. Run local verification:
>    - For build errors: `pnpm turbo build`
>    - For type errors: `pnpm turbo check-types`
>    - For lint errors: `pnpm exec biome check .`
>    - For test failures: `pnpm turbo test`
> 4. Ensure the fix passes locally before reporting
>
> **Rules:**
> - Use `pnpm` exclusively — never `npm` or `npx`
> - Minimal changes only — fix the failure, don't refactor
> - Kill processes before starting: `pkill -f "next-server|next start|next dev" 2>/dev/null`
>
> Return a structured summary:
> - Files modified (full paths)
> - What changed and why
> - Local verification results (pass/fail per command)
> - Confidence level (high/medium/low) that this fixes the CI failure

### Step 3.3: Handle Infrastructure Fixes

For permission/infra issues, present the user with:

1. **What's wrong**: The exact error message
2. **What needs to change**: The IAM policy, secret, or config that's missing
3. **How to fix it**: Provide the exact AWS CLI command or console steps
4. **Optional**: If it can be fixed via workflow YAML or SST config changes, offer to implement that

---

## Phase 4: Push & Monitor

### Step 4.1: Confirm with User

Before pushing, present:

> **Fix Summary:**
> - Workflow: [NAME]
> - Root cause: [CAUSE]
> - Changes: [LIST OF MODIFIED FILES]
> - Local verification: [PASS/FAIL]
>
> Ready to commit and push to trigger a new deploy?

Options:
- **Push now** — Commit with descriptive message and push
- **Review changes first** — Show the diff
- **Abort** — Don't push

### Step 4.2: Commit and Push

```bash
git add [specific files]
git commit -m "fix: [descriptive message for the CI failure]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push origin main
```

### Step 4.3: Monitor the New Run

After pushing, monitor the triggered workflow:

1. Wait 10 seconds for the run to appear
2. Get the new run ID:
   ```bash
   gh run list --repo causeflow/web --limit 3 --json databaseId,name,status,createdAt
   ```
3. Poll every 30 seconds for status:
   ```bash
   gh run view [NEW_RUN_ID] --repo causeflow/web --json jobs --jq '.jobs[] | {name, status, conclusion}'
   ```
4. Report progress to the user as steps complete

### Step 4.4: Verify Green

When the run completes:

- **If GREEN**: Report success with a summary
  > **Deploy fixed!** Run #[ID] completed successfully.
  > - Build: PASS
  > - Deploy Staging: PASS
  > - E2E Tests: PASS
  > - [Link to run]

- **If RED again**: Go back to Phase 2 with the new failure logs. Max 3 retry cycles before asking the user for guidance.

---

## Phase 5: Multi-Workflow Handling

When multiple workflows are failing:

1. Check if they share a root cause (same commit, same error)
2. If **shared cause**: Fix once, both should pass
3. If **different causes**: Fix sequentially, starting with the simpler one
4. Track each workflow's status independently

---

## Special Cases

### E2E Test Failures
- Download test artifacts if available: `gh run download [RUN_ID] --repo causeflow/web`
- Compare against local E2E results
- E2E flakes: If the same test passes locally but fails in CI, check for timing issues, viewport differences, or network-dependent assertions

### SST Deploy Failures
- Check `apps/[app]/sst.config.ts` for misconfigurations
- SST version mismatch: Ensure CI pins to v3.19.0 (as per CLAUDE.md)
- Pulumi state issues: May need `sst unlock` (requires user confirmation)

### Secret/Environment Issues
- `AUTH_SECRET: ""` → Secret not set in GitHub Actions
- Use GitHub MCP or `gh` CLI to check: `gh secret list --repo causeflow/web`
- Guide user to set missing secrets

---

## Compact Recovery

If `/compact` is called:
1. Re-read `session-learnings.md`
2. Re-run Phase 1 to get current workflow status
3. Resume from where the investigation left off

---

## Standards

- All `gh` commands target `--repo causeflow/web`
- GitHub MCP tools (`mcp__github__*`) for PR/issue operations, commit inspection
- `gh` CLI for workflow runs, logs, secrets (MCP doesn't cover Actions API)
- Never push without user confirmation
- Never force push
- Always verify locally before pushing
- Keep fixes minimal — only what's needed to make CI green
- Log findings to `session-learnings.md` for future reference

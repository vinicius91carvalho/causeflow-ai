---
name: worktree-manager
description: Safe git worktree workflow that prevents work loss. Creates isolated worktrees, enforces commit-before-switch discipline, preserves session context, and handles merging back to main. Use when the user says "worktree", "parallel work", "branch off", "isolate work", "safe branch", or "merge worktree".
---

# Worktree Manager — Safe Parallel Work Without Losing Code

Manages git worktrees with a commit-first, context-preserved workflow that prevents work loss. Every worktree gets automatic context anchoring so sessions can be resumed safely.

**Inherited from CLAUDE.md:**
- Context Engineering — orchestrator pattern, subagent communication
- Session Learnings — compact-safe memory
- Model Assignment Matrix — haiku/sonnet/opus per task type

---

## Commands

The user triggers this skill with natural language. Detect which command they want:

| User Says | Command |
|---|---|
| "start a worktree", "new worktree", "branch off for X" | **CREATE** |
| "list worktrees", "show worktrees", "what branches am I working on" | **LIST** |
| "save worktree", "checkpoint", "save my work" | **SAVE** |
| "switch worktree", "go to worktree X" | **SWITCH** |
| "merge worktree", "bring changes back", "merge X to main" | **MERGE** |
| "cleanup worktrees", "remove worktree", "prune" | **CLEANUP** |
| "worktree status", "what's the state of my worktrees" | **STATUS** |

---

## Command: CREATE

Create a new isolated worktree for a task.

### Step 1: Save Current Work First (CRITICAL)

Before creating anything, protect current work:

```bash
# Check for uncommitted changes
git status --porcelain
```

If there are uncommitted changes, **STOP and ask the user**:

> You have uncommitted changes on `[current-branch]`. I need to save these before creating a new worktree.
>
> Options:
> 1. **Commit now** — I'll create a descriptive commit with your changes
> 2. **Stash** — Save changes temporarily (risk of forgetting)
> 3. **Abort** — Stay on current branch

Default to option 1. Never silently discard changes.

### Step 2: Create the Worktree

```bash
# Determine base branch (default: main)
BASE_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")

# Create worktree with descriptive name
WORKTREE_NAME="[user-provided-name or auto-generated]"
WORKTREE_PATH=".claude/worktrees/$WORKTREE_NAME"
BRANCH_NAME="worktree-$WORKTREE_NAME"

git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME" "$BASE_BRANCH"
```

### Step 3: Create Context Anchor

Create a `WORKTREE_CONTEXT.md` in the worktree root — Claude reads this automatically on session resume:

```markdown
# Worktree: [NAME]

## Created
- Date: [YYYY-MM-DD HH:MM]
- Base branch: [BASE]
- Branch: worktree-[NAME]
- Purpose: [USER'S DESCRIPTION]

## Current State
- Status: IN_PROGRESS
- Last checkpoint: [timestamp]

## Decisions Made
(Updated as work progresses)

## In Progress
- [ ] [Initial task items from user]

## Next Steps
(Updated before each session end)
```

### Step 4: Install Dependencies

```bash
cd "$WORKTREE_PATH"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
```

### Step 5: Report to User

> **Worktree created:**
> - Path: `.claude/worktrees/[NAME]`
> - Branch: `worktree-[NAME]`
> - Base: `[BASE_BRANCH]`
>
> To start Claude in this worktree:
> ```bash
> cd .claude/worktrees/[NAME] && claude
> ```
> Or from a new terminal:
> ```bash
> claude --worktree [NAME]
> ```

---

## Command: SAVE (Checkpoint)

Create a safety commit that preserves all current work with rich context.

### Step 1: Gather Context

```bash
git status --porcelain
git diff --stat
git log --oneline -3
```

### Step 2: Create Anchor Commit

```bash
git add -A
git commit -m "checkpoint: [brief description of current state]

Session context:
- What was done: [summary of changes]
- Decisions made: [key decisions]
- In progress: [what's partially done]
- Next steps: [what to do next]
- Known issues: [any blockers or bugs found]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Step 3: Update WORKTREE_CONTEXT.md

Update the context file with current state, decisions, and next steps.

### Step 4: Confirm

> **Work saved.** Commit `[hash]` on branch `worktree-[NAME]`.
> Your work is safe — you can switch worktrees or close this session.

---

## Command: LIST

Show all active worktrees with their status.

```bash
git worktree list --porcelain
```

For each worktree, display:

| Worktree | Branch | Last Commit | Uncommitted Changes | Path |
|---|---|---|---|---|
| [name] | worktree-[name] | [hash] [message] [date] | Yes/No | [path] |

Highlight any worktrees with uncommitted changes in a warning.

---

## Command: STATUS

Deep status check across all worktrees.

Spawn a **haiku** agent to check each worktree:
- Uncommitted changes count
- Commits ahead of base branch
- Last commit date
- Whether WORKTREE_CONTEXT.md exists and is current
- Merge conflict potential (check if base branch has diverged)

Present a dashboard-style report.

---

## Command: SWITCH

Switch to working in a different worktree.

### Step 1: Save Current Work (MANDATORY)

Run the **SAVE** command first. Never switch with uncommitted changes.

### Step 2: Switch

```bash
cd [target-worktree-path]
```

### Step 3: Load Context

Read the target worktree's `WORKTREE_CONTEXT.md` and present it:

> **Resuming worktree `[NAME]`:**
> - Purpose: [purpose]
> - Last checkpoint: [date]
> - In progress: [items]
> - Next steps: [steps]

---

## Command: MERGE

Bring worktree changes back to the main branch.

### Step 1: Pre-merge Checks

```bash
# Ensure worktree is clean
cd [worktree-path]
git status --porcelain

# Build check
pnpm turbo build

# Test check
pnpm turbo test
```

If build or tests fail, **STOP** and fix before merging.

### Step 2: Confirm with User

> **Ready to merge `worktree-[NAME]` → `[BASE_BRANCH]`:**
>
> **Commits to merge:**
> [list of commits with messages]
>
> **Files changed:**
> [summary of file changes]
>
> **Verification:**
> - Build: PASS/FAIL
> - Tests: PASS/FAIL
>
> Proceed with merge?

### Step 3: Execute Merge

```bash
# Switch to main branch (in the main working directory, not worktree)
cd /root/projects/causeflow-ai
git checkout [BASE_BRANCH]
git pull origin [BASE_BRANCH]

# Merge the worktree branch
git merge "worktree-[NAME]" --no-edit
```

### Step 4: Handle Conflicts

If merge conflicts occur, spawn an **opus** agent:

> Resolve merge conflicts between `worktree-[NAME]` and `[BASE_BRANCH]`.
> Preserve both sides' intent. The worktree branch contains: [CONTEXT].
> The base branch recent changes: [CONTEXT].

### Step 5: Post-merge Verification

```bash
pnpm turbo build
pnpm turbo test
```

### Step 6: Ask About Cleanup

> **Merge complete.** Branch `worktree-[NAME]` merged into `[BASE_BRANCH]`.
>
> Do you want to:
> 1. **Keep the worktree** — for further work on this branch
> 2. **Remove the worktree** — clean up (branch and directory deleted)
> 3. **Keep branch, remove worktree directory** — branch stays for reference

---

## Command: CLEANUP

Remove worktrees safely.

### Step 1: Check for Unsaved Work

For each worktree to remove:

```bash
cd [worktree-path]
git status --porcelain
git log --oneline "origin/main..HEAD"
```

### Step 2: Warn About Unmerged Work

If the worktree has commits not in main:

> **WARNING:** Worktree `[NAME]` has **[N] unmerged commits**:
> [list commits]
>
> These will be LOST if you remove the worktree. Options:
> 1. **Merge first** — run the MERGE command
> 2. **Push branch to remote** — keeps commits on GitHub as backup
> 3. **Remove anyway** — permanently lose these changes
> 4. **Cancel** — keep the worktree

### Step 3: Execute Cleanup

```bash
git worktree remove [worktree-path]
git branch -d "worktree-[NAME]"   # -d (safe delete, fails if unmerged)
```

If `-d` fails (unmerged), ask user to confirm `-D` (force delete).

### Step 4: Prune

```bash
git worktree prune
```

---

## Auto-Save Rules (Always Active)

These rules apply whenever working inside a worktree, regardless of which command was invoked:

1. **Before any destructive operation** (checkout, reset, clean): Run SAVE first
2. **Before context compaction** (`/compact`): Run SAVE first, update WORKTREE_CONTEXT.md
3. **Every 30 minutes of active work**: Prompt the user for a checkpoint
4. **Before session end**: Always create a checkpoint commit

---

## Recovery: Lost Work

If the user says they lost work:

### Step 1: Check Reflog

```bash
git reflog --all | head -30
git reflog show "worktree-[NAME]" 2>/dev/null | head -20
```

### Step 2: Check Stash

```bash
git stash list
```

### Step 3: Check Dangling Commits

```bash
git fsck --unreachable --no-reflogs | grep commit | head -20
```

For each found commit, show the message and date so the user can identify their work.

### Step 4: Recover

```bash
# Create a recovery branch from the found commit
git branch "recovery-[NAME]" [COMMIT_HASH]
```

---

## Integration with Subagent Worktrees

When spawning subagents with `isolation: "worktree"`:

1. Each subagent auto-gets its own worktree
2. Subagent worktrees auto-cleanup if no changes made
3. If changes exist, the orchestrator handles merge via the MERGE command
4. **Subagents must NOT**: modify WORKTREE_CONTEXT.md, install deps, push to remote

---

## Standards

- **NEVER delete a worktree with uncommitted changes** without explicit user confirmation
- **NEVER switch worktrees without saving** current work first
- **ALWAYS create WORKTREE_CONTEXT.md** in new worktrees for session continuity
- **ALWAYS use `pnpm`** — never npm/npx
- **ALWAYS verify build/tests** before merging
- Use `git branch -d` (safe) before `git branch -D` (force)
- Log worktree operations to session-learnings.md

---
name: check-and-fix-tasks
description: Front-end specialist that reviews and fixes issues from a markdown task file, using Playwright for verification and requiring user confirmation before marking tasks as done. Supports parallel fixes for independent issues using git worktrees.
---

# Front-End Specialist — Website Bug Fix Workflow

You are a Specialist Front-End Engineer. Identify your task file from:
1. The user's request (if they specify a file path)
2. The most recent pending task file in `docs/tasks/website/bugfix/`
3. Ask the user if unclear

**Inherited from CLAUDE.md** (applies to all steps below):
- Context Engineering — orchestrator pattern, subagent communication, context budget
- Model Assignment Matrix — haiku/sonnet/opus per task type
- Parallel Execution with Worktrees — batch planning, isolation, merge protocol
- Session Learnings — compact-safe memory at `session-learnings.md`
- Self-Improvement Protocol — compile, persist, generate rules

**Skill-specific model overrides:**

| Task Type | Model | Note |
|---|---|---|
| Simple CSS/style/text fixes | `haiku` | Mechanical, scoped |
| Standard bug fixes | `sonnet` | Needs code understanding |
| Complex multi-component fixes | `opus` | Broad UI awareness |
| Audit/regression check | `sonnet` | Systematic checking |
| Playwright verification | Main agent | Needs browser tools |

---

## Step 1: Read & Analyze the Task File

Spawn a **haiku** agent to read the task file and return:
- List of all pending (unchecked) items with their text
- For each item: likely affected file(s), complexity level (simple/standard/complex), dependencies on other items

If no pending items, report complete and stop.

---

## Step 2: Group Into Parallel Batches

If 3+ pending items, spawn a **haiku** agent to analyze independence per the **Batch Planning** rules from CLAUDE.md:

> Given these pending bug fix items and their affected files:
> [LIST FROM STEP 1]
>
> Group into parallel batches. Same-batch items must be INDEPENDENT (different files, different components, no shared deps). Return JSON batches with model assignments.

If only 1-2 items, work sequentially (skip batching).

---

## Step 3: Fix Each Batch

### Case A: Parallel Batch (2+ independent items)

Spawn agents **simultaneously in a single message** using `isolation: "worktree"`:

```
Task(subagent_type: "general-purpose", model: [assigned], isolation: "worktree", prompt: "Fix item...")
Task(subagent_type: "general-purpose", model: [assigned], isolation: "worktree", prompt: "Fix item...")
```

Each agent's prompt:

> You are a Front-End Fix Agent. Fix this specific issue:
> **Item:** [ITEM_TEXT]
> **Task file:** [PATH] — do NOT update checkboxes (the orchestrator handles this after merge)
>
> 1. Locate the relevant code for this item
> 2. Perform a deep code review of the affected area
> 3. Implement the fix following mobile-first order
> 4. If you encounter something structural, note it but keep your fix scoped
> 5. Run `pnpm turbo build` to verify no build errors
> 6. Return a structured summary: files modified (full paths), what changed, any concerns
>
> **Standards:** Tailwind/Radix conventions, mobile-first, zero console errors, `pnpm` only.

**After all agents complete:** Follow the **Merge Protocol** from CLAUDE.md.

### Case B: Sequential Items (dependent or single items)

Spawn a subagent per item. If something strange is found, spawn an **opus** sub-agent to investigate before continuing.

---

## Step 3.5: Simplify Changed Code

After each batch's fixes are complete (and merged, if parallel), invoke the `/simplify` skill to review the changed code for reuse, quality, and efficiency. Fix any issues it finds before proceeding to verification.

---

## Step 4: Playwright Verification

After simplification passes:

1. Use the Playwright tool to render the page in **Chromium Headless**
2. Navigate through the relevant UI flows for each fixed item
3. **Read the browser console logs on every page you visit**
4. If console errors/warnings found, fix immediately and re-run until clean
5. **Screenshots**: Save to `./screenshots/[task-name]/` with descriptive filenames

---

## Step 5: Audit Agent

Once Playwright passes with a clean console, spawn an audit agent (`model: "sonnet"`):

> Independently verify that:
> - Each fix resolves its task as described
> - No regressions in nearby components
> - If parallel worktree fixes, they work correctly together after merge
> - No unused imports, debug code, or inconsistent styling
>
> Items fixed: [LIST]. Files modified: [LIST].
> Return a structured summary: pass/fail per item, any issues found.

If issues found, fix and repeat Steps 4-5.

---

## Step 6: Ask for My Confirmation (MANDATORY — do not skip)

After the audit agent approves:

1. **Stop. Do not update the task file yet.**
2. Tell me:
   > "I've implemented and verified the fix for **[Item Name(s)]**. Please check it in your browser now."
3. Ask me:
   > "Is this resolved? (Yes / No)"
4. **Wait for my reply.**

- **If "Yes"**: Go to Step 7.
- **If "No"**: Spawn a new agent to fix based on feedback, then repeat from Step 4.

---

## Step 7: Mark Tasks as Complete

Update the markdown file:
```
- [x] Task Name — Fixed. [Brief description of what changed and why.]
```

Then move on to the next batch, starting from Step 3.

---

## Step 8: Learning & Self-Improvement

After ALL items resolved (or session ends), follow the **Self-Improvement Protocol** from CLAUDE.md, plus this skill-specific final report:

```
## Bug Fix Session Complete

### Work Summary
- Items fixed: N
- Items failed/deferred: X
- User retries (rejected fixes): Y
- Parallel batches: B (N items parallelized)

### Model Usage
- haiku: N fixes | sonnet: M fixes | opus: X fixes

### Merge Results
- Worktree merges: N successful, X conflicts resolved

### Files Modified
- `path/to/file.tsx` — [what changed]

### Patterns Found
- [Pattern]: description → saved to MEMORY.md
```

---

## Standards (skill-specific, in addition to CLAUDE.md)

- Follow the project's existing Tailwind and Radix UI conventions
- Zero console errors in the final result
- Keep changes minimal and surgical unless a broader refactor is clearly needed
- Worktree agents must NOT update task file checkboxes — orchestrator handles after merge + user confirmation
- All Playwright verification uses Chromium only
- Screenshots saved to `./screenshots/[task-name]/`
- Log every user rejection (Step 6 "No") to session-learnings.md with feedback reason

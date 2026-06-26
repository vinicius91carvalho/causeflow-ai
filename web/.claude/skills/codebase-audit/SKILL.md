---
name: codebase-audit
description: Audits the entire monorepo, updates documentation (CLAUDE.md, MEMORY.md, session-learnings.md), and ensures all project knowledge is current. Use when the user says "audit", "sync docs", "update docs", "check documentation", "refresh memory", or "what's the current state". Spawns parallel agent teams per app/package.
---

# Codebase Audit — Documentation Sync & Knowledge Refresh

Audit the entire monorepo state, compare against existing documentation, apply targeted updates, and produce a consolidated report. Operates as an **orchestrator** coordinating parallel exploration agents and sequential update agents — never reading source code directly in the main agent.

**Inherited from CLAUDE.md** (applies to all phases below):
- Context Engineering — orchestrator pattern, subagent communication, context budget
- Model Assignment Matrix — haiku/sonnet/opus per task type
- Session Learnings — compact-safe memory at `session-learnings.md`

---

## Phase 1: Spawn Parallel Audit Agents

Spawn all 7 agents **in a single message** for true parallelism. Each uses `subagent_type: "Explore"` and `model: "haiku"`. Each agent must return a **structured markdown summary** (target ~15-20 lines of actionable info).

### Agent 1: Website Audit

> Analyze `apps/website/` and return a structured summary covering:
>
> 1. **Routes** — List every App Router page file (`page.tsx`) with its route path
> 2. **Components** — Total count and list of all component files under `src/components/`
> 3. **Dependencies** — Key runtime deps from `package.json` (framework, UI, i18n, analytics)
> 4. **Config** — `next.config.mjs` notable settings (transpilePackages, security headers, redirects)
> 5. **Middleware** — What middleware files exist and what they do
> 6. **i18n** — Locales configured, message file locations, route structure
> 7. **Metadata/SEO** — How page metadata is generated (helper functions, open graph setup)
> 8. **SST Config** — `sst.config.ts` deployment targets, environment variables set, domain names
> 9. **Tests** — Count of Vitest test files and Playwright spec files
> 10. **Build artifacts** — Whether `.next/` exists (built vs not built)
>
> Return a structured markdown summary with headers for each area above. Flag anything that looks inconsistent or outdated.

### Agent 2: Dashboard Audit

> Analyze `apps/dashboard/` and return a structured summary covering:
>
> 1. **Routes** — List every App Router page file (`page.tsx`) and API route (`route.ts`) with their paths
> 2. **Components** — Total count and list of all component files under `src/components/`
> 3. **Dependencies** — Key runtime deps from `package.json` (auth, database, UI, analytics)
> 4. **Auth setup** — Auth.js version, providers configured, Cognito integration details
> 5. **Middleware** — What middleware files exist and what they do (auth guards, staging gate)
> 6. **Database layer** — Any ORM, database client, schema files present
> 7. **SST Config** — `sst.config.ts` deployment targets, env vars injected, domain names, Cognito config
> 8. **Tests** — Count of Vitest test files; any Playwright test coverage
> 9. **Build artifacts** — Whether `.next/` exists (built vs not built)
> 10. **Deployment status** — Any deploy output or known staging/production URLs in config
>
> Return a structured markdown summary with headers for each area above. Flag anything that looks inconsistent or outdated.

### Agent 3: Shared Package Audit

> Analyze `packages/shared/` and return a structured summary covering:
>
> 1. **Exports** — What `package.json` `exports` field exposes (entry points)
> 2. **Types** — List of type definition files and the key types they export
> 3. **Constants** — List all constants files; for the most important ones (SITE, etc.) include actual values
> 4. **i18n messages** — Structure of `en.json` and `pt-br.json` (top-level keys and rough count)
> 5. **Middleware functions** — What middleware utilities are exported (staging-auth, etc.) and their signatures
> 6. **Utils** — List utility functions exported
> 7. **Tests** — Count of test files
> 8. **Build output** — Whether `dist/` or compiled output exists
>
> Return a structured markdown summary with headers for each area above. Flag anything that looks inconsistent or outdated.

### Agent 4: UI Package Audit

> Analyze `packages/ui/` and return a structured summary covering:
>
> 1. **Components** — List all component files exported from this package
> 2. **Exports** — What `package.json` `exports` field exposes
> 3. **Theme system** — Folder structure under `src/themes/`, how themes are loaded, available theme names
> 4. **CSS architecture** — How `base.css`, `tokens/light.css`, `tokens/dark.css` are organized; Tailwind v4 approach
> 5. **Fonts** — What fonts are configured and how they are loaded
> 6. **Shadcn/ui** — Which shadcn components are present
> 7. **Tests** — Count of test files
>
> Return a structured markdown summary with headers for each area above. Flag anything that looks inconsistent or outdated.

### Agent 5: Utility Packages Audit

> Analyze `packages/analytics/`, `packages/forms/`, and `packages/auth/` (if it exists) and return a structured summary covering each package:
>
> **For each package:**
> 1. **Existence** — Does this package directory exist?
> 2. **Exports** — What does `package.json` `exports` expose?
> 3. **Key files** — List source files and their purpose
> 4. **Providers/hooks** — What React providers or hooks are exported?
> 5. **Key functions** — What are the main exported functions/classes?
> 6. **Dependencies** — External deps used
> 7. **Tests** — Count of test files
>
> Return a structured markdown summary with a section per package. Flag missing packages or packages that exist but are not documented.

### Agent 6: Infrastructure Audit

> Analyze the project infrastructure and return a structured summary covering:
>
> 1. **GitHub Workflows** — List all files in `.github/workflows/`, for each: trigger conditions, what it does, which app it targets
> 2. **Root configs** — Key settings in `turbo.json` (pipeline tasks, caching), `biome.json` (rules enabled), `vitest.config.ts` (test patterns, coverage), `playwright.config.ts` (viewports, base URL, webServer config), root `package.json` (workspace scripts, shared devDependencies)
> 3. **Env files** — List all `.env*` files that exist at root and in each app (names only, no values)
> 4. **Git status** — Current branch, any uncommitted changes, recent tag if any
> 5. **pnpm workspace** — `pnpm-workspace.yaml` contents (which packages are included)
> 6. **Deployment architecture** — Based on `sst.config.ts` files, describe the AWS architecture (CloudFront, S3, Lambda, Cognito, etc.)
> 7. **Node/pnpm versions** — From `.nvmrc`, `.node-version`, or `package.json` engines field
>
> Return a structured markdown summary with headers for each area above. Flag anything that looks inconsistent or outdated.

### Agent 7: Documentation Audit

> Analyze the current state of all project documentation and return a structured summary covering:
>
> 1. **CLAUDE.md accuracy** — Read `/root/projects/causeflow-ai/CLAUDE.md`. Check: monorepo structure matches actual folders, routes list matches actual pages, tech stack versions match package.json, environment URLs match SST configs, commands actually work
> 2. **MEMORY.md accuracy** — Read `/root/.claude/projects/-root-projects-causeflow-ai/memory/MEMORY.md`. Check: build status claims, key file paths still exist, deployment status, known issues still relevant, line count (must stay under 200)
> 3. **patterns.md accuracy** — Read `/root/.claude/projects/-root-projects-causeflow-ai/memory/patterns.md` if it exists. Check: are documented patterns still valid? Any obvious gaps?
> 4. **session-learnings.md freshness** — Read `/root/.claude/projects/-root-projects-causeflow-ai/memory/session-learnings.md` if it exists. Report: last updated date, active tasks listed, any stale entries
> 5. **Task files** — Scan all files under `docs/tasks/`. Report: total count, count with all items completed (`[x]`), count with pending items (`[ ]`), list of files with pending items
>
> Return a structured markdown summary with a section per document. For each document, list: (a) what is accurate, (b) what is outdated, (c) what is missing, (d) what is wrong.

---

## Phase 2: Compile Findings

Process all 7 agent results. For each documentation file, produce a gap analysis:

### Gap Analysis Structure

For each area covered by the 7 agents, compare against `CLAUDE.md`, `MEMORY.md`, `patterns.md`, and `session-learnings.md`:

- **Accurate** — Information that matches reality (no change needed)
- **Outdated** — Information that was once true but is no longer (needs update)
- **Missing** — Facts that are true but not documented anywhere (needs adding)
- **Wrong** — Information that is factually incorrect (needs correction)

Prioritize changes:
1. **Wrong** first — incorrect information actively misleads
2. **Outdated** second — stale info causes confusion
3. **Missing** third — gaps reduce utility
4. **Accurate** — log for confirmation, no action needed

---

## Phase 3: Apply Updates

Based on the gap analysis, spawn update agents sequentially using `model: "sonnet"` and `subagent_type: "general-purpose"`. Run only the agents where changes are needed.

### Update Agent 1: CLAUDE.md

Only run if gaps were found in CLAUDE.md.

> You are a Documentation Update Agent. Update `/root/projects/causeflow-ai/CLAUDE.md` based on these findings:
>
> **Changes needed:**
> [PASTE SPECIFIC OUTDATED/WRONG/MISSING ITEMS FROM COMPILE PHASE]
>
> **Rules:**
> 1. Use the `Edit` tool for targeted changes — do NOT rewrite the entire file
> 2. Only update what is actually wrong or outdated — preserve accurate content exactly
> 3. Preserve all headings, structure, and formatting
> 4. Update the Monorepo Structure section if folders changed
> 5. Update the Routes section if pages were added or removed
> 6. Update the Tech Stack table if versions changed
> 7. Update Environment URLs if domains changed
> 8. Do NOT change the workflow rules or standards sections unless they are factually wrong
>
> Return: list of specific edits made (line ranges changed, what was old, what is new).

### Update Agent 2: MEMORY.md

Only run if gaps were found in MEMORY.md.

> You are a Documentation Update Agent. Update `/root/.claude/projects/-root-projects-causeflow-ai/memory/MEMORY.md` based on these findings:
>
> **Changes needed:**
> [PASTE SPECIFIC OUTDATED/WRONG/MISSING ITEMS FROM COMPILE PHASE]
>
> **Rules:**
> 1. Use the `Edit` tool for targeted changes — do NOT rewrite the entire file
> 2. Hard limit: MEMORY.md must stay under 200 lines. If it is approaching 200 lines, consolidate or remove stale entries before adding new ones
> 3. Only update what actually changed — preserve accurate content exactly
> 4. Update the Build Status section with current deployment state
> 5. Update Key Files paths if any moved or were renamed
> 6. Update Known Issues to reflect current state
> 7. Add new entries for persistent patterns discovered during this audit
>
> Return: list of specific edits made; final line count of the file.

### Update Agent 3: session-learnings.md

Always run — add the audit summary regardless of other changes.

> You are a Documentation Update Agent. Append an audit summary to `/root/.claude/projects/-root-projects-causeflow-ai/memory/session-learnings.md`.
>
> Create this file if it does not exist. Append (do not overwrite) a new section:
>
> ```markdown
> ## Codebase Audit — [DATE]
>
> ### Monorepo State Snapshot
> [PASTE THE STRUCTURED FINDINGS FROM ALL 7 AGENTS — condensed to key facts only]
>
> ### Documentation Changes Applied
> [LIST OF DOCS UPDATED AND WHAT CHANGED]
>
> ### Audit Findings Summary
> - Accurate: [count] items confirmed correct
> - Outdated: [count] items updated
> - Missing: [count] items added
> - Wrong: [count] items corrected
> ```
>
> Return: confirmation that section was appended, section line count.

### Update Agent 4: patterns.md

Only run if the audit revealed new troubleshooting patterns not currently documented.

> You are a Documentation Update Agent. Update `/root/.claude/projects/-root-projects-causeflow-ai/memory/patterns.md`.
>
> Create this file if it does not exist.
>
> **New patterns to add:**
> [PASTE PATTERNS FROM COMPILE PHASE NOT CURRENTLY IN patterns.md]
>
> **Rules:**
> 1. Only add patterns confirmed during this audit — do not invent
> 2. Format each pattern as: trigger → solution → reason
> 3. Do not duplicate existing entries
> 4. Keep each entry concise (3-5 lines max)
>
> Return: list of patterns added.

---

## Phase 4: Generate Audit Report

Present the full audit results to the user:

```
## Codebase Audit Report — [DATE]

### Monorepo State
| Area        | Pages/Routes      | Components   | Tests  | Dependencies | Status    |
|-------------|-------------------|--------------|--------|--------------|-----------|
| Website     | X pages           | Y components | Z tests | N deps      | Deployed  |
| Dashboard   | X pages + Y APIs  | Y components | Z tests | N deps      | Staging   |
| shared      | —                 | —            | Z tests | 0           | Published |
| ui          | —                 | Y primitives | Z tests | N deps      | Published |
| analytics   | —                 | 1 provider   | Z tests | N deps      | Published |
| forms       | —                 | 1 hook       | Z tests | N deps      | Published |
| auth        | —                 | 2 providers  | Z tests | N deps      | Published |

### Documentation Updates Applied
- CLAUDE.md: [list of changes, or "no changes needed"]
- MEMORY.md: [list of changes, or "no changes needed"] (final line count: N/200)
- session-learnings.md: audit summary appended
- patterns.md: [list of patterns added, or "no changes needed"]

### Issues Found
- [Any inconsistencies between docs and reality]
- [Any stale task files with uncompleted work]
- [Any MEMORY.md entries that are wrong or outdated]

### Task File Status
- Total task files: N
- Fully completed: M (all checkboxes checked)
- Has pending items: X (list file paths)

### Recommendations
- [Suggestions for further improvements based on audit findings]
- [Any technical debt or documentation gaps worth addressing]
```

---

## Compact Recovery

If `/compact` is called during an audit:

1. Re-read `session-learnings.md` — look for a `## Codebase Audit —` section to determine if the audit already ran
2. If Phase 1 completed (audit section exists with agent results): skip to Phase 2 using the recorded findings
3. If Phase 2-3 completed (documentation changes listed): skip to Phase 4 (generate report)
4. If no audit section found: restart from Phase 1

---

## Standards

- All audit agents use `subagent_type: "Explore"` — read-only analysis, no code changes
- Update agents use `subagent_type: "general-purpose"` with `model: "sonnet"`
- Discovery agents use `model: "haiku"` — fast, cheap, parallel
- **Never modify source code** — this skill only updates documentation files
- **MEMORY.md hard limit: 200 lines** — enforce before adding new content
- Always spawn all 7 audit agents in a single message for true parallelism
- Use `Edit` tool for targeted documentation changes — never `Write` for full rewrites
- Only update documentation that is actually wrong, outdated, or missing — do not rewrite accurate content
- Report to user after all updates complete with the full Phase 4 report
- Log findings to `session-learnings.md` so audit history is preserved across compactions

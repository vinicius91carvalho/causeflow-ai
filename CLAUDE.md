# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this directory is

`/root/projects/causeflow/` is **not a monorepo**. It is a parent folder containing five independent sibling git repositories. There is no top-level `package.json`, `pnpm-workspace.yaml`, or `turbo.json` — running `pnpm install` here will fail. Always `cd` into the specific component before running commands.

## The five components

| Path              | Role                                                                    | Per-repo guide              |
| ----------------- | ----------------------------------------------------------------------- | --------------------------- |
| `core/`           | TypeScript backend. AI-powered incident investigation engine.           | `core/CLAUDE.md`            |
| `web/`            | Turborepo monorepo: marketing site + product dashboard (Next.js 15).    | `web/CLAUDE.md`             |
| `relay/`          | Customer-side DB relay agent. Runs as a Docker container in customer net. | `relay/CLAUDE.md`         |
| `docs/`           | Public Mintlify documentation site.                                     | `docs/CLAUDE.md`            |
| `test-scenarios/` | Manual QA scenarios (markdown only, no build).                          | `test-scenarios/CLAUDE.md`  |

## How they fit together

- A customer deploys `relay` inside their private network. It opens an outbound WebSocket tunnel to `core` — no inbound firewall rules required.
- `core` is the control plane: ingests incidents, runs the investigation state machine, dispatches AI agents (Mastra + Anthropic SDK), and queries customer databases through `relay` over JSON-RPC 2.0.
- `web/apps/dashboard` is the product UI; it calls `core` HTTP APIs with Clerk-authenticated, tenant-scoped requests.
- `web/apps/website` is the public marketing site (SSG).
- `docs/` is the public documentation, deployed separately on Mintlify.

## Per-repo quick start

Each repo has its own toolchain — see its `CLAUDE.md` for the full matrix. Most-used entry points:

- `core/`: pnpm 9.15.0 · `pnpm dev` (tsx watch) · `pnpm test:run` (unit) · `pnpm lint-invariants` (architecture compliance I1–I7)
- `web/`: pnpm 10 + Turborepo · `pnpm dev` · `pnpm test` (Vitest) · `pnpm test:e2e` (Playwright) · `pnpm check` (Biome)
- `relay/`: npm · `npm run dev` (tsx watch) · `npm run build` · semantic-release publishes to DockerHub `causeflowai/relay`
- `docs/`: Mintlify · `mint dev` (preview) · `mint broken-links`
- `test-scenarios/`: no build; markdown only.

## Cross-repo conventions

These constraints apply across **all** repos:

- **Environment naming**: only `staging` and `production`. Never `prod`, `prd`, or `dev`-as-environment. (Enforced in `core` as invariant I7.)
- **Tenant isolation (IDOR)**: `tenantId` is always extracted server-side from the Clerk JWT `org_id` claim. Never trust a `tenantId` in a request body or query parameter. (Enforced in `web` as W4, mirrored in `core`.)
- **No monorepo merges**: a change spanning multiple components requires one PR per repo. Coordinate by deploy order: `relay` → `core` → `web`.
- **AWS auth in CI**: only OIDC role-to-assume — static AWS keys in workflows are forbidden. (Core invariants I1–I3.)

## Plan & PRD artefacts

Planning output is project-local. Don't expect anything in `~/.claude/plans/`:

- **`/plan` PRDs** → `<repo>/docs/tasks/<area>/<category>/<dirname>/`. PRDs
  spanning multiple sibling repos live in the **first repo of the deploy
  chain** (`relay → core → web`). One PRD, one `progress.json`, never split.
- **ExitPlanMode markdown** → `<repo>/docs/plans/<slug>.md` (relocated from
  `~/.claude/plans/` by the global PostToolUse hook). `<repo>` is the git
  toplevel of the directory `claude` was launched from — for causeflow that
  means whichever sibling repo (`core/`, `web/`, `relay/`, `docs/`) you
  `cd` into before running `claude`. The parent folder
  `/root/projects/causeflow/` itself isn't a git repo, so plans never land
  here.

## Workflow Conventions

- **Always `cd` into a specific component before invoking `/plan-build-test`, `/ship-test-ensure`, or any build/test command.** This umbrella folder has no `package.json`, no `progress.json`, and no Execution Config — workflow skills cannot run from here. The plan-build-test "Phase 0a" precondition will block this case explicitly.
- **PRDs spanning multiple sibling repos** live in the first repo of the deploy chain (`relay → core → web`). One PRD, one `progress.json`, never split. Coordinate cross-repo execution by deploy order in the same PRD.
- **After squash-merging a PR**, expect local rebase to auto-trigger on next `git pull`. Abort any interactive rebase cleanly, fast-forward main, then delete the local feature branch by name (don't rely on `--merged` since squash leaves the branch unmerged in git's view).
- **Staging verification is against deployed URLs, never local builds.** Use Playwright against the staging URL (see each repo's CLAUDE.md for staging URLs and health endpoints). Local dev server verification is for `/plan-build-test` Phase 5; staging verification belongs to `/verify-staging` and `/ship-test-ensure`.
- **Auto-deploys to production are unexpected and should be flagged.** Production deploys go through `/ship-test-ensure` with an explicit human gate. If a merge to `main` triggers a prod deploy without that gate, surface it immediately — it's a CI misconfiguration, not normal behavior.

## Test Wiring

- **New test files MUST be wired into the runner's discovery path before the task is considered done.** Each repo defines its own discovery convention (see per-repo CLAUDE.md): Vitest globs in `web/`, the explicit suite list in `core/`, etc. A test file outside discovery is functionally absent — it never runs in CI.
- **Verification:** after adding a test file, run the repo's full suite and confirm the suite count increased by the expected amount. If the count is unchanged, the test isn't wired.
- **Wrapper scripts** (e.g. regression scripts under `core/scripts/`) are wired by being added to the runner's loop, not by existing on disk. Always grep the runner for the new filename after adding it.

## Environment Notes (proot-distro ARM64)

This dev environment is sandboxed and lacks several live credentials. Detect and flag upfront — do NOT half-attempt a task that requires them.

- **AWS credentials are not present.** Anything touching ECS Exec, S3, Secrets Manager, or DynamoDB will fail at the AWS SDK layer. If a task requires AWS access, stop and tell the user "this proot env has no AWS creds — run from a host with `aws sts get-caller-identity` working" rather than partial-running until the SDK errors.
- **Clerk session cookies are not available.** Anything that needs a logged-in dashboard session (visual checks behind auth, tenant-scoped API calls) cannot run here. Same protocol: detect and report, don't half-run.
- **Shell portability:** prefer `sort -V` over `awk`/`grep` for version comparison (grep -E with semver patterns has bitten the claude-hud setup). Use `[[:space:]]` instead of `\s` in grep — `\s` is a GNU-grep extension and not portable.
- **Native modules** (esbuild, sharp, better-sqlite3, etc.) often need rebuild after install in proot. If `pnpm install` succeeds but the binary fails at runtime with "wrong ELF" or "exec format error", run the package's rebuild command before retrying.

## Where to look for more

- Architecture invariants: each repo's `INVARIANTS.md`.
- Deeper architectural notes and module structure: each repo's `CLAUDE.md` and `README.md`.
- Manual QA / repro recipes: `test-scenarios/`.
# Plan: Create top-level CLAUDE.md for causeflow workspace

## Context

`/root/projects/causeflow/` is the parent folder for the CauseFlow product but has no top-level `CLAUDE.md`, no git repo of its own, and no monorepo tooling. It contains **5 independent sibling git repositories** plus screenshots and test docs:

- `core/` — TypeScript backend (incident investigation engine)
- `web/` — Next.js 15 + Turborepo monorepo (marketing site + dashboard)
- `relay/` — Customer-side DB relay agent (Docker)
- `docs/` — Mintlify documentation site
- `test-scenarios/` — Manual QA scenarios (no build, plain markdown)

Each sub-repo already has its own `CLAUDE.md`. Future Claude instances launched from the workspace root currently get no orientation about the multi-repo layout, where to `cd`, or how the components fit together. They will likely try to run `pnpm install` at the root (no package.json exists) or assume it's a single repo.

The top-level `CLAUDE.md` should be a thin **navigation file**: explain the layout, point to per-repo `CLAUDE.md` files, and describe how the components fit together at the product level. It should NOT duplicate per-repo command lists.

## Approach

Write a concise top-level `CLAUDE.md` (~80–120 lines) at `/root/projects/causeflow/CLAUDE.md` with these sections:

1. **Header** — required prefix block.
2. **What this directory is** — one paragraph: "this is NOT a monorepo, it is a parent folder containing 5 sibling git repos; cd into the relevant one before doing anything."
3. **Components map** — bulleted list, one line per component naming purpose + per-component `CLAUDE.md` path. This is the single most important section.
4. **How the components fit together** — short prose: customer networks run `relay` (Docker) → relay tunnels to `core` over outbound WebSocket → `core` orchestrates AI investigation agents → `web/apps/dashboard` consumes core APIs (Clerk auth, tenant-scoped) → `docs` is the public Mintlify site → `test-scenarios` is manual QA.
5. **Cross-repo conventions** — only the small set of constraints that apply across all repos:
   - **Naming**: only `staging` and `production` (never `prod`) — pulled from core invariant I7.
   - **Tenant isolation**: tenantId is always extracted server-side from Clerk JWT `org_id`, never from request body (web invariant W4 / core boundary).
   - **Multi-repo workflow**: changes spanning core+web require coordinated PRs in each repo independently; there is no monorepo merge.
6. **Per-repo quick start** — for each repo, 2–3 lines: directory, package manager, primary dev command, link to its `CLAUDE.md` for the full list. No exhaustive script enumeration.
7. **Where things live** — pointers only:
   - Architecture invariants: each repo's `INVARIANTS.md`
   - Per-repo deeper docs: each repo's `CLAUDE.md` and `README.md`
   - Top-level screenshots / test scenarios: `test-scenarios/`

## Critical files

- **Create**: `/root/projects/causeflow/CLAUDE.md`
- **Read for cross-references** (not modified):
  - `/root/projects/causeflow/core/CLAUDE.md`
  - `/root/projects/causeflow/web/CLAUDE.md`
  - `/root/projects/causeflow/relay/CLAUDE.md`
  - `/root/projects/causeflow/docs/CLAUDE.md`
  - `/root/projects/causeflow/test-scenarios/CLAUDE.md`
  - `/root/projects/causeflow/core/INVARIANTS.md` (for I7 staging/production rule)
  - `/root/projects/causeflow/web/INVARIANTS.md` (for W4 tenant isolation rule)

## Content outline (the actual file)

```
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## What this directory is

`/root/projects/causeflow/` is NOT a monorepo. It is a parent folder
containing five independent sibling git repositories. There is no
top-level `package.json`, `pnpm-workspace.yaml`, or `turbo.json` — running
`pnpm install` here will fail. Always `cd` into the specific component
before running commands.

## The five components

| Path              | Role                                                                     | Per-repo guide |
| ----------------- | ------------------------------------------------------------------------ | --------------- |
| `core/`           | TypeScript backend. AI-powered incident investigation engine.            | `core/CLAUDE.md` |
| `web/`            | Turborepo monorepo: marketing site + product dashboard (Next.js 15).     | `web/CLAUDE.md` |
| `relay/`          | Customer-side DB relay agent. Runs as Docker container in customer net.  | `relay/CLAUDE.md` |
| `docs/`           | Public Mintlify documentation site.                                      | `docs/CLAUDE.md` |
| `test-scenarios/` | Manual QA scenarios (markdown only, no build).                           | `test-scenarios/CLAUDE.md` |

## How they fit together

- A customer deploys `relay` inside their private network. It opens an
  outbound WebSocket tunnel to `core`.
- `core` is the control plane: ingests incidents, runs the investigation
  state machine, dispatches AI agents (Mastra + Anthropic SDK), and
  queries customer databases through `relay` over JSON-RPC 2.0.
- `web/apps/dashboard` is the product UI; it calls `core` HTTP APIs with
  Clerk-authenticated, tenant-scoped requests.
- `web/apps/website` is the public marketing site (SSG).
- `docs/` is the public documentation, separately deployed.

## Per-repo quick start

Each repo has its own toolchain — see its `CLAUDE.md` for the full
matrix. Most-used entry points:

- `core/`: pnpm 9.15.0 · `pnpm dev` (tsx watch) · `pnpm test:run` (unit)
  · `pnpm lint-invariants` (architecture compliance I1–I7)
- `web/`: pnpm 10 + Turborepo · `pnpm dev` · `pnpm test` (Vitest) ·
  `pnpm test:e2e` (Playwright) · `pnpm check` (Biome)
- `relay/`: npm · `npm run dev` (tsx watch) · `npm run build` ·
  semantic-release publishes to DockerHub `causeflowai/relay`
- `docs/`: Mintlify · `mint dev` (preview) · `mint broken-links`
- `test-scenarios/`: no build; markdown only.

## Cross-repo conventions

These constraints apply across all repos:

- **Environment naming**: only `staging` and `production`. Never `prod`,
  `prd`, or `dev`-as-environment. (Enforced in `core` as invariant I7.)
- **Tenant isolation (IDOR)**: `tenantId` is always extracted server-side
  from the Clerk JWT `org_id` claim. Never trust a `tenantId` in a
  request body or query parameter. (Enforced in `web` as W4, mirrored in
  `core`.)
- **No monorepo merges**: a change spanning multiple components requires
  one PR per repo, coordinated by deploy order (relay → core → web).
- **AWS auth in CI**: only OIDC role-to-assume; static AWS keys in
  workflows are forbidden. (Core invariants I1–I3.)

## Where to look for more

- Architecture invariants: each repo's `INVARIANTS.md`.
- Deeper architectural notes & module structure: each repo's `CLAUDE.md`
  and `README.md`.
- Manual QA / repro recipes: `test-scenarios/`.
- Workspace-level screenshots from incident replays sit at the workspace
  root (e.g. `sentry-trigger-result.png`); they're scratch artifacts,
  not part of any repo.
```

## Verification

After writing the file:

1. `ls -la /root/projects/causeflow/CLAUDE.md` — confirm the file exists.
2. Open the file and skim — it should fit roughly one screen of a terminal,
   not be exhaustive. Per-repo sections should be 2–3 lines each, not full
   command tables.
3. Cross-reference one fact per repo against the source-of-truth file:
   - `pnpm 9.15.0` — confirmed in `core/package.json` `packageManager` field.
   - `Turborepo + pnpm 10` — confirmed in `web/pnpm-workspace.yaml` and
     `web/package.json`.
   - `causeflowai/relay` Docker tag — confirmed in `relay/README.md`.
4. Spot-check that no per-repo command list is duplicated wholesale (e.g.
   the file should NOT list every `test:*` script that core has — that
   lives in `core/CLAUDE.md`).
5. Confirm the "NOT a monorepo" framing is at the top — it is the single
   most important orientation fact.

No code execution is needed; the deliverable is a single markdown file.

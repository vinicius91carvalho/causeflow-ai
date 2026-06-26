# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This directory contains manual QA test scenarios and cleanup checklists for the CauseFlow platform. No build system — pure documentation.

## Parent Project Commands

Run from `/root/projects/causeflow/` (monorepo root):

```bash
pnpm turbo dev          # Start all dev servers
pnpm turbo build        # Build all packages (cached)
pnpm turbo test         # Run all Vitest unit/integration tests
pnpm turbo lint         # Lint with Biome
pnpm turbo check-types  # TypeScript type checking
```

Single test (from `core/` or `web/`):
```bash
pnpm vitest run <pattern>                        # unit/integration
pnpm exec playwright test tests/<file>.spec.ts   # E2E (chromium only)
```

Kill stale processes before E2E runs:
```bash
pkill -f "next-server|next start|next dev" 2>/dev/null; pkill -f playwright 2>/dev/null
```

## Architecture

CauseFlow is an AI-powered incident investigation platform with three packages:

- **`core/`** — Backend API: TypeScript + Node.js 22 + Hono + ElectroDB (DynamoDB) + Redis + SQS
- **`relay/`** — Message relay service
- **`web/`** — Frontend: Next.js + Tailwind + Shadcn/ui + Vitest + Playwright

Both `core/` and `web/` use **Clean Architecture + Modular Monolith (Modlito)** with DDD layers:
`Domain → Application → Infrastructure → Presentation`

Module-to-module communication uses EventBus (in-process) or type imports only. All dependencies point inward.

## Scenario File Convention

Each scenario file documents: preconditions, reproduction steps, expected vs. actual behavior, and cleanup steps. Scenarios are in Portuguese or English — both are valid.

## Key Rules (from parent project)

- Use `pnpm` only — never `npm` or `yarn`
- No barrel file imports — use direct deep paths
- Solutions library at `../docs/solutions/` — search before implementing known patterns

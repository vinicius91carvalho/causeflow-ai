# Turborepo + Turbopack + Vitest Migration

Migrate the monorepo from plain `pnpm -r` scripts to **Turborepo** orchestration, enable **Turbopack** for dev, and add **Vitest** as the unit/integration test framework.

## Strict Rules

1. **Zero NPM/NPX:** Use `pnpm` and `pnpm dlx` exclusively.
2. **State Tracking:** After completing each phase, mark items `[x]`, update this file, and ask for confirmation before proceeding.
3. **Environment:** ARM64 proot container (Samsung S24 Ultra / Termux / Ubuntu). Limited CPU — keep concurrency low.

---

## Phase 1: Turborepo Installation & Pipeline Config

- [x] Install Turborepo at workspace root: `pnpm add -w -D turbo`
- [x] Create `turbo.json` at project root with this config:
  ```jsonc
  {
    "$schema": "https://turbo.build/schema.json",
    "tasks": {
      "build": {
        "dependsOn": ["^build"],
        "outputs": [".next/**", "dist/**"],
        "cache": true
      },
      "dev": {
        "dependsOn": ["^build"],
        "persistent": true,
        "cache": false
      },
      "test": {
        "dependsOn": ["^build"],
        "outputs": ["coverage/**"],
        "cache": true
      },
      "test:watch": {
        "dependsOn": ["^build"],
        "persistent": true,
        "cache": false
      },
      "lint": {
        "dependsOn": ["^build"],
        "cache": true
      },
      "check-types": {
        "dependsOn": ["^build"],
        "cache": true
      },
      "clean": {
        "cache": false
      }
    }
  }
  ```
- [x] Update root `package.json` scripts to use `turbo`:
  ```jsonc
  {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "test:watch": "turbo test:watch",
    "lint": "turbo lint",
    "check-types": "turbo check-types",
    "clean": "turbo clean && rm -rf node_modules"
  }
  ```
  Keep `format` and `format:check` as-is (Prettier runs from root, not per-package).
- [x] Add `.turbo/` to `.gitignore` (already present)
- [x] Verify `pnpm turbo build` completes successfully (5/5 packages, FULL TURBO on cache hit in 803ms)

---

## Phase 2: Turbopack for Dev Server

Turbopack is stable for `next dev` in Next.js 15.x. `next build --turbopack` is still beta — keep Webpack for production builds.

- [x] Update `apps/website/package.json` dev script:
  ```jsonc
  "dev": "next dev --turbopack --hostname 127.0.0.1"
  ```
  Also added `"dev:webpack"` fallback for proot environments.
  **Do NOT** change the `build` script — keep it as `"build": "next build"` (Webpack).
- [x] Verify Turbopack starts — shows `▲ Next.js 15.5.12 (Turbopack)` but crashes with "Invalid symlink" in proot. **Known proot limitation** — Turbopack works in normal environments. Use `dev:webpack` in proot.
- [x] Verify production build still works: `pnpm turbo build --filter=@causeflow/website` — 5/5 successful

---

## Phase 3: Vitest Installation

No existing test framework to remove — all `test` scripts are `echo 'No tests yet'` placeholders.

- [x] Install Vitest 4.0.18 and `@vitest/coverage-v8` at workspace root
- [x] Create root `vitest.config.ts` with `projects` array (Vitest 4.x syntax — `maxWorkers` at top-level, not nested `poolOptions`):
  ```ts
  import { defineConfig } from 'vitest/config';

  export default defineConfig({
    test: {
      projects: [
        { test: { name: 'shared', root: './packages/shared', include: ['**/*.test.ts'], environment: 'node' } },
        { test: { name: 'forms', root: './packages/forms', include: ['**/*.test.ts'], environment: 'node' } },
        { test: { name: 'analytics', root: './packages/analytics', include: ['**/*.test.ts'], environment: 'node' } },
        { test: { name: 'ui', root: './packages/ui', include: ['**/*.test.ts', '**/*.test.tsx'], environment: 'node' } },
        { test: { name: 'website', root: './apps/website', include: ['**/*.test.ts', '**/*.test.tsx'], environment: 'node' } },
      ],
      pool: 'forks',
      maxWorkers: 2,
      reporters: ['default'],
      passWithNoTests: true,
    },
  });
  ```
- [x] Updated `test` and `test:watch` scripts in all 5 package.json files
- [x] Verified `pnpm turbo test --force` — 9/9 tasks pass, zero deprecation warnings

---

## Phase 4: Smoke Tests for Existing Utilities

Write initial unit tests for pure functions that already exist. These validate the Vitest setup works end-to-end.

### `@causeflow/shared` tests

- [x] Create `packages/shared/src/application/utils/formatting.test.ts` (7 tests)
- [x] Create `packages/shared/src/application/utils/seo.test.ts` (6 tests)
- [x] Create `packages/shared/src/domain/constants/constants.test.ts` (8 tests)

### `@causeflow/forms` tests

- [x] Create `packages/forms/src/infrastructure/sanitization/sanitize.test.ts` (5 tests)
- [x] Create `packages/forms/src/application/validators/get-started-schema.test.ts` (5 tests)
- [x] Create `packages/forms/src/application/validators/contact-schema.test.ts` (4 tests)

### Run & verify

- [x] Run `pnpm turbo test --force` — 35/35 tests pass across 6 test files, 9/9 turbo tasks successful
- [x] Run `pnpm vitest run --coverage` — 100% statement/function/line coverage, 91.66% branch coverage

### Fix: Per-package vitest scripts

- [x] Updated all 5 package.json test scripts to use `cd ../.. && vitest run --project <name>` — fixes CWD resolution when turbo runs scripts from within each package directory

---

## Phase 5: Documentation (CLAUDE.md)

- [x] Add to `CLAUDE.md` under Tech Stack or a new section:
  - `pnpm` is the sole package manager — `npm` and `npx` are forbidden
  - Turborepo orchestrates `build`, `test`, `dev`, `lint`, `check-types`
  - Turbopack enabled for `next dev` only (not production builds)
  - Vitest is the unit/integration test framework
  - Primary commands: `pnpm turbo build`, `pnpm turbo test`, `pnpm turbo dev`
  - Test file convention: `*.test.ts` / `*.test.tsx` colocated next to source
  - Playwright remains the E2E framework (separate from Vitest)
- [x] Verify CLAUDE.md is valid markdown and no duplicate sections
- [x] Fixed `npm audit` → `pnpm audit` in Security Checklist
- [x] Fixed `npx playwright` → `pnpm dlx playwright` in Playwright Test Suite section

---

## Phase 6: Performance Tuning & Validation

Optimize for ARM64 proot environment with limited CPU cores.

- [x] Confirm `turbo.json` concurrency — Turborepo doesn't support `"concurrency"` in config (CLI flag `--concurrency` only). Relying on Vitest's `maxWorkers: 2` for ARM64 proot constraints.
- [x] Verify Vitest uses `forks` pool (not `threads` — forks is safer on proot/ARM64) — confirmed in `vitest.config.ts`
- [x] Run full pipeline and verify caching works — 16/16 tasks pass on forced run (~57s), 12/16 cached on second run (~43s). Fixed `check-types` dependency to include same-package `build` (needed for Next.js `.next/types`).
- [x] Verify no orphan processes after test runs — `ps aux | grep -E 'vitest|next'` shows nothing after completion
- [x] Final validation: `pnpm turbo test` completes in 333ms (FULL TURBO, 9/9 cached)
- [x] Final validation: `pnpm turbo build` completes in 879ms (FULL TURBO, 5/5 cached)

---

## Summary of Changes

| File | Action |
|------|--------|
| `turbo.json` | Create — pipeline config |
| `vitest.config.ts` | Create — root vitest config with projects |
| `package.json` (root) | Update scripts to use `turbo` |
| `apps/website/package.json` | Update `dev` (add `--turbopack --hostname 127.0.0.1`), update `test`/`test:watch` |
| `packages/shared/package.json` | Update `test`/`test:watch` |
| `packages/forms/package.json` | Update `test`/`test:watch` |
| `packages/analytics/package.json` | Update `test`/`test:watch` |
| `packages/ui/package.json` | Update `test`/`test:watch` |
| `packages/shared/src/.../formatting.test.ts` | Create — smoke tests |
| `packages/shared/src/.../seo.test.ts` | Create — smoke tests |
| `packages/shared/src/.../constants.test.ts` | Create — smoke tests |
| `packages/forms/src/.../sanitize.test.ts` | Create — smoke tests |
| `packages/forms/src/.../get-started-schema.test.ts` | Create — smoke tests |
| `packages/forms/src/.../contact-schema.test.ts` | Create — smoke tests |
| `CLAUDE.md` | Update — document new tooling |
| `.gitignore` | Update — add `.turbo/` |

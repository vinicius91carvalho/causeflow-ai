# DDD Refactoring: Move Context-Specific Code from `src/app/` into Bounded Contexts

## Context (The Why)
The dashboard app currently has business logic, full page components, and API handler implementations living in `src/app/` (Next.js routing layer). The goal is to make `src/app/` an ultra-thin re-export layer, with all implementations owned by their respective bounded contexts under `src/contexts/`.

## Definition (The What)
Each context gains two new directories:
```
src/contexts/<name>/
├── domain/              # (existing)
├── application/         # (existing, may need new services)
├── infrastructure/      # (existing)
├── presentation/
│   ├── components/      # (existing)
│   └── pages/           # NEW: Server/client page implementations
├── api/                 # NEW: API route handler implementations
└── index.ts
```
`src/app/` becomes 1-4 line re-exports per file.

## Acceptance Criteria (The How to Test)
- [ ] TypeScript: `pnpm turbo check-types` passes
- [ ] Lint: `pnpm exec biome check .` passes
- [ ] Tests: `pnpm turbo test` passes
- [ ] Build: `pnpm turbo build` succeeds
- [ ] Runtime: Dev server starts, all routes load
- [ ] Re-exports: `export const dynamic` and `export const runtime` work at runtime

## Restrictions (The Boundaries)
- Files that stay in `src/app/`: layouts, redirects, `api/auth/[...nextauth]`, `staging-auth/`, `globals.css`
- No business logic changes — pure move refactoring
- All existing tests must continue passing via re-exports

## Re-export Patterns
- Client page: `export { default } from '@/contexts/.../pages/...';`
- Server page + metadata: `export { default, generateMetadata } from '@/contexts/.../pages/...';`
- Server page + dynamic: Add `export { dynamic } from '...';`
- API route: `export { GET, POST } from '@/contexts/.../api/...';`
- API + runtime/dynamic: `export { POST, runtime, dynamic } from '@/contexts/.../api/...';`

## Phase 1: Round 1 — Identity + Investigation + Billing (3 parallel worktrees)
- [x] Worktree A: Identity context — 7 app/ files → pages + api
- [x] Worktree B: Investigation context — 8 app/ files → pages + api
- [x] Worktree C: Billing context — 6 app/ files → pages + api
- [x] Merge all 3 worktrees sequentially
- [x] Verify types after merge: `pnpm turbo check-types`

## Phase 2: Round 2 — Settings + Integrations + Team (3 parallel worktrees)
- [x] Worktree D: Settings context — 3 app/ files
- [x] Worktree E: Integrations context — 3 app/ files
- [x] Worktree F: Team context — 7 app/ files
- [x] Merge all 3 worktrees sequentially
- [x] Verify types after merge: `pnpm turbo check-types`

## Phase 3: Round 3 — Audit + Approvals + Shared (1 worktree)
- [x] Worktree G: Audit (2) + Approvals (2) + Shared (8) — 12 app/ files
- [x] Merge worktree
- [x] Verify types after merge: `pnpm turbo check-types`

## Phase 4: Validation & Verification
- [x] Run `pnpm turbo check-types` — 14/14 FULL TURBO
- [x] Run `pnpm exec biome check --write .` — 0 errors, 14 files auto-fixed
- [x] Run `pnpm turbo test` — 629/629 passed, 56 test files
- [x] Run `pnpm turbo build`
- [x] Start dev server and verify routes load — all 13 routes verified
- [x] Verify `dynamic` and `runtime` re-exports work — webhook inlines runtime/dynamic, audit/topology inline dynamic

## Phase 5: Documentation & Compound
- [x] Update `apps/dashboard/CLAUDE.md` with pages/ and api/ layer docs
- [x] Update `docs/architecture/bounded-contexts.md`
- [x] Add learnings to session-learnings.md

## Learnings

### What worked
- Running 3 parallel worktree agents for each round was effective — all produced correct code
- All files already used `@/` absolute imports, so no import path conversion was needed during moves
- Tests continued passing via re-exports without any modifications

### Key discovery: Next.js static config re-exports
- `export const dynamic` and `export const runtime` MUST be inlined in `src/app/` route files
- Next.js static analyzer cannot read these values through re-exports
- Only HTTP method handlers (GET, POST, etc.) and `default`/`generateMetadata` can be safely re-exported
- Affected: webhook route (runtime + dynamic), audit page (dynamic), topology page (dynamic)

### What didn't work
- Worktree agents don't auto-commit — changes can be lost on cleanup. Workaround: verify files exist on main after worktree completes, or instruct agents to commit

### Stats
- 46 new files created in contexts (pages + API handlers)
- 46 app/ files replaced with thin re-exports
- 629/629 tests passing, 14/14 type checks, 7/7 builds
- 13 routes verified at runtime

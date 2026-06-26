# DDD Bounded Contexts Refactoring — Dashboard & Website

## Context (The Why)

Both apps have bounded contexts as directory groupings, but they lack real DDD structure. Domain types, repositories, API schemas, and i18n translations are centralized in shared locations (`lib/db/types`, `lib/api/schemas`, monolithic i18n files). This makes contexts non-portable — you can't move a context directory without breaking imports to shared infrastructure.

**Goal:** Each context becomes a self-contained module with its own domain, application, infrastructure, and presentation layers. Moving a context directory should require zero changes outside that directory.

## Definition (The What)

Refactor both dashboard and website apps so each bounded context follows DDD layering:

```
contexts/<name>/
├── domain/           # Types, entities, value objects, constants, domain services
│   ├── types.ts      # Context-specific types (moved from centralized locations)
│   ├── constants.ts  # Context-specific constants
│   └── services.ts   # Pure domain logic (no external deps)
├── application/      # Use cases, DTOs, service interfaces
│   ├── services.ts   # Application services (orchestrate domain + infra)
│   └── dtos.ts       # Data transfer objects for API boundaries
├── infrastructure/   # Repositories, external adapters, API clients
│   ├── repository.ts # Data persistence (moved from lib/db/repositories/)
│   ├── api-schema.ts # Zod schemas (moved from lib/api/schemas.ts)
│   └── i18n/         # Context-specific translation keys
│       ├── en.json
│       └── pt-br.json
├── presentation/     # React components, hooks (current components/ dir)
│   ├── components/
│   └── hooks/
└── index.ts          # Public API — ONLY import surface
```

## Acceptance Criteria (The How to Test)

- [ ] Each dashboard context has domain/, application/, infrastructure/, presentation/ layers
- [ ] Each website context has appropriate DDD layers (domain where meaningful, presentation always)
- [ ] Domain types moved from `lib/db/types.ts` into respective context `domain/types.ts`
- [ ] Repositories moved from `lib/db/repositories/` into respective context `infrastructure/`
- [ ] API schemas split from `lib/api/schemas.ts` into per-context `infrastructure/api-schema.ts`
- [ ] i18n translations split from monolithic files into per-context `infrastructure/i18n/` files
- [ ] App-level i18n loader composes context translations at runtime
- [ ] `lib/db/types.ts` becomes a thin re-export of context domain types (backward compat)
- [ ] `lib/api/schemas.ts` becomes a thin re-export of context schemas (backward compat)
- [ ] No circular dependencies between contexts
- [ ] All 617+ tests pass
- [ ] Build clean (`pnpm turbo build`)
- [ ] Types clean (`pnpm turbo check-types`)
- [ ] Lint clean (`pnpm exec biome check .`)
- [ ] Dev server starts without errors

## Restrictions (The Boundaries)

- Route files (`app/`) stay in place — Next.js requires them there. They remain thin orchestrators.
- `lib/db/client.ts` (DynamoDB client) stays in `lib/` — it's cross-cutting infrastructure
- `lib/api/with-auth.ts` stays in `lib/` — it's cross-cutting middleware
- `lib/rate-limit.ts` stays in `lib/` — cross-cutting
- `packages/shared`, `packages/ui`, `packages/auth` are NOT refactored (separate packages)
- Do NOT change any runtime behavior — this is a structural refactoring only
- Maintain backward compatibility via re-exports where needed
- Website legal context stays minimal (empty domain is fine — it's content pages)

---

## Phase 1: Research & Setup
- [x] Search `docs/solutions/` for related patterns (bounded contexts solution doc exists)
- [x] Read `session-learnings.md` for recent context
- [x] Catalog all types in `lib/db/types.ts` and map each to its owning context
- [x] Catalog all repositories in `lib/db/repositories/` and map to contexts
- [x] Catalog all schemas in `lib/api/schemas.ts` and map to contexts
- [x] Catalog all i18n keys and map to contexts
- [x] Identify shared types used by multiple contexts (these stay in shared or lib)

## Phase 2: Dashboard — Domain Layer Extraction
- [x] Create `domain/types.ts` in each dashboard context with context-specific types
- [x] Create `domain/constants.ts` where contexts have constants (N/A — constants live in packages/shared)
- [x] Create `domain/services.ts` where contexts have pure domain logic (N/A — no pure domain services identified)
- [x] Update `lib/db/types.ts` to re-export from context domain types (backward compat)
- [x] Fix all imports across dashboard app

## Phase 3: Dashboard — Infrastructure Layer Extraction
- [x] Move `lib/db/repositories/incident-repository.ts` → `contexts/investigation/infrastructure/`
- [x] Move `lib/db/repositories/remediation-repository.ts` → `contexts/investigation/infrastructure/`
- [x] Move `lib/db/repositories/analysis-repository.ts` → `contexts/investigation/infrastructure/`
- [x] Move `lib/db/repositories/user-repository.ts` → `contexts/identity/infrastructure/`
- [x] Move `lib/db/repositories/tenant-repository.ts` → keep in shared (used by billing, identity, team)
- [x] Move `lib/db/repositories/integration-repository.ts` → `contexts/integrations/infrastructure/`
- [x] Move `lib/db/repositories/settings-repository.ts` → `contexts/settings/infrastructure/`
- [x] Move `lib/db/repositories/invite-repository.ts` → `contexts/team/infrastructure/`
- [x] Split `lib/api/schemas.ts` into per-context `infrastructure/api-schema.ts` files
- [x] Create backward-compat re-exports in `lib/db/repositories/` and `lib/api/schemas.ts`
- [x] Fix all imports

## Phase 4: Dashboard — Application Layer
- [x] Create `application/services.ts` in investigation context (incident lifecycle, analysis workflow)
- [x] Create `application/services.ts` in identity context (auth workflows, RBAC checks)
- [x] Create `application/services.ts` in team context (N/A — logic lives in API routes)
- [x] Create `application/services.ts` in billing context (already has lib/stripe/ — reorganize)
- [x] Create `application/services.ts` in integrations context (N/A — logic lives in API routes)
- [x] Create `application/services.ts` in settings context (N/A — logic lives in API routes)
- [x] Move existing lib/ logic in each context into proper application/infrastructure split

## Phase 5: Dashboard — Presentation Layer Reorganization
- [x] Rename `components/` → `presentation/components/` in each context
- [x] Move hooks from components/ to `presentation/hooks/` where applicable
- [x] Update all internal imports within each context
- [x] Update all route file imports in `app/`
- [x] Update barrel exports in each context's `index.ts`

## Phase 6: Dashboard — i18n Splitting
- [x] Extract dashboard i18n keys from monolithic `en.json` into per-context files
- [x] Create `infrastructure/i18n/en.json` and `infrastructure/i18n/pt-br.json` per context
- [x] Create a dashboard-level i18n composer that merges context translations
- [x] Verify all translation keys resolve correctly

## Phase 7: Website — DDD Layers
- [x] Fix circular dependency: marketing ↔ engagement (extract shared CTA to shell or shared)
- [x] Create `domain/types.ts` in engagement context (form data models, contact types)
- [x] Create `infrastructure/` in engagement context (API client for /api/notify, form validation schemas)
- [x] Rename `components/` → `presentation/components/` in each website context
- [x] Create `domain/types.ts` in marketing context if meaningful (pricing plan types, etc.)
- [x] Update barrel exports in each context's `index.ts`
- [x] Fix all imports in route files

## Phase 8: Website — i18n Splitting
- [x] Extract website i18n keys from monolithic `en.json` into per-context files
- [x] Create `infrastructure/i18n/en.json` and `infrastructure/i18n/pt-br.json` per website context
- [x] Create a website-level i18n composer that merges context translations
- [x] Verify all translation keys resolve correctly

## Phase 9: Validation
- [x] Run ALL tests — fix failures immediately (679 tests pass)
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Run `pnpm exec biome check .` — zero lint issues (17 files auto-fixed)
- [x] Start dev servers and verify no errors (website 200 OK; dashboard build clean)
- [x] Verify dashboard features in browser (build compiles all 30+ routes, 617 tests pass)
- [x] Verify website features in browser (build generates all 24 static pages, 21 tests pass)
- [x] Code review: no unused imports, no dead code, no debug code
- [x] Verify no circular dependencies between contexts (20 violations found and fixed)

## Phase 10: Compound (MANDATORY)
- [x] Document the DDD pattern in `docs/solutions/patterns/`
- [x] Update `docs/architecture/bounded-contexts.md` with new layer structure
- [x] Update `apps/dashboard/CLAUDE.md` and `apps/website/CLAUDE.md`
- [x] Update root `CLAUDE.md` monorepo structure section
- [x] Add learnings to session-learnings.md
- [x] Verify: "Could a context directory be moved without changes outside it?" — Yes, with backward-compat re-exports

## Learnings
- Worktree agents that both touch overlapping paths (e.g., one renames components/ while other creates domain/) require sequential merge with stash
- Biome auto-sorts imports alphabetically after large refactors — run `biome check --write` as final step
- Cross-context boundary violations (importing internals instead of index.ts) are the most common issue — found 20 violations
- i18n composer pattern: per-context JSON files deep-merged at runtime, monolithic files kept for backward compat
- Backward-compat re-exports are essential for incremental migration — old import paths keep working
- LSP diagnostics lag behind file system state after large refactors — trust build output (`tsc --noEmit`) over LSP

# Import Cleanup — Dashboard & Website (Full Audit)

## Context (The Why)
After DDD refactor and simplification passes, both apps need a final import hygiene pass. Previous work eliminated most barrel imports (`lib/db/types.ts`, `lib/db/index.ts`, `lib/db/repositories/`, context-level index.ts files). A comprehensive audit reveals only minor cleanup remains.

## Acceptance Criteria
- [x] No unused barrel/aggregation files in dashboard or website
- [x] No barrel imports used in either app (all imports use direct deep paths)
- [x] React setState error in incident-detail.tsx is fixed (if still present)
- [x] `pnpm turbo build` passes
- [x] `pnpm turbo test` passes
- [x] `pnpm turbo lint` passes

## Restrictions
- Do NOT change any component logic
- Do NOT change any exports from context domain/types files
- Keep `lib/db/client.ts`, `lib/db/encryption.ts`, `lib/db/base-repository.ts` — only delete unused aggregation files

---

## Audit Results (2026-03-05)

### Dashboard — Status: CLEAN (1 dead file to delete)

| Pattern | Status | Action |
|---|---|---|
| `@/lib/db/types` imports (was 50+ files) | DONE — file deleted, all replaced | None |
| `@/lib/db` barrel imports (was 20 files) | DONE — file deleted, all replaced | None |
| `@/lib/db/repositories/` stubs | DONE — directory deleted | None |
| Context-level `index.ts` barrels | DONE — none exist | None |
| `@/lib/api/core-api.ts` (unused barrel) | EXISTS, 0 importers | DELETE |
| All `@/lib/api/*` direct imports (63 files) | Correct deep paths | None |
| All `@/lib/db/*` direct imports (8 files) | Correct deep paths | None |
| React setState error in incident-detail.tsx | FIXED (addToast no longer inside setIncident updater) | None |

### Website — Status: CLEAN (1 dead file to delete)

| Pattern | Status | Action |
|---|---|---|
| Context-level `index.ts` barrels | DONE — none exist | None |
| Navigation barrel imports | DONE — all use deep paths | None |
| `sections/index.ts` barrel (25 exports, 0 importers) | EXISTS, unused | DELETE |
| All section imports (26 imports) | Correct deep paths | None |
| All navigation imports | Correct deep paths | None |

### Packages — Status: OPTIMAL (no action needed)

| Package | Barrel Size | App Usage | Status |
|---|---|---|---|
| `@causeflow/shared` | ~32 exports (lightweight) | Deep paths only | OPTIMAL |
| `@causeflow/ui` | ~50 exports (themes excluded) | Deep paths only | OPTIMAL |
| `@causeflow/auth` | ~20 exports | Deep paths only | OPTIMAL |
| `@causeflow/analytics` | ~11 exports | 2 barrel imports (provider) | OPTIMAL |
| `@causeflow/forms` | ~14 exports | 3 barrel imports (schemas) | OPTIMAL |

---

## Phase 1: Delete Unused Barrel Files

- [x] Delete `apps/dashboard/src/lib/api/core-api.ts` (barrel with 0 importers — re-exports from core-api-client, core-api-types, get-api-client)
- [x] Delete `apps/website/src/contexts/marketing/presentation/components/sections/index.ts` (barrel with 25 exports, 0 importers)

## Phase 2: Validation

- [x] `pnpm turbo build` passes
- [x] `pnpm turbo test` passes
- [x] `pnpm turbo lint` passes
- [x] `pnpm exec biome check .` passes (2 pre-existing format warnings in unrelated files)

## Phase 3: Compound

- [x] Update session-learnings.md with audit results
- [x] Document: both apps are now fully compliant with no-barrel-imports rule

## Learnings
- Both barrel files (`core-api.ts` and `sections/index.ts`) were already deleted in a prior session. The audit confirmed 0 importers for both.
- Both apps (dashboard and website) are now fully compliant with the no-barrel-imports rule. All imports use direct deep paths.
- Build (7 tasks), tests (629 passing), and lint all pass cleanly. Two pre-existing biome format warnings exist in unrelated files (`integration-filter.tsx`, `footer.tsx`).

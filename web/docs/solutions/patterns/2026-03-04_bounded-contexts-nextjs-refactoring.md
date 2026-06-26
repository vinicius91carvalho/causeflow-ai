---
title: Bounded Contexts in Next.js App Router — Refactoring Pattern
date: 2026-03-04
category: patterns
tags: [ddd, bounded-contexts, next.js, refactoring, architecture, microfrontend, clean-architecture, i18n]
app: shared
severity: medium
---

# Bounded Contexts in Next.js App Router — Refactoring Pattern

## Problem
Next.js apps tend to organize code by type (components/, lib/, hooks/) rather than by domain. As the app grows, this makes it hard to understand domain boundaries, leads to tangled cross-feature imports, and prevents future extraction into microfrontends or microservices.

## Solution

### Phase 1: Flat Bounded Contexts (initial refactoring)

Create `src/contexts/` with one directory per bounded context:

```
src/contexts/<context-name>/
├── components/          # React components
│   └── __tests__/       # Colocated tests
├── hooks/               # Custom hooks (optional)
├── lib/                 # Domain-specific logic (optional)
├── types.ts             # Domain types (optional)
└── index.ts             # Public API barrel
```

### Phase 2: DDD Layer Structure (full clean architecture)

Evolve each context to use explicit DDD layers. Only create layers the context actually needs:

```
src/contexts/<context-name>/
├── domain/              # Pure business logic — no framework dependencies
│   ├── types.ts         # Domain types, entities, value objects
│   ├── rbac/            # Role/permission definitions (identity context only)
│   └── stripe-types.ts  # Stripe-specific domain types (billing context only)
├── application/         # Use cases and orchestration
│   ├── services.ts      # Business logic, use case orchestration
│   ├── incident-simulator.ts  # Domain service (investigation context)
│   └── __tests__/       # Application-layer unit tests
├── infrastructure/      # External concerns: DB, APIs, i18n, schemas
│   ├── i18n/            # Per-context translation files
│   │   ├── en.json
│   │   └── pt-br.json
│   ├── *-repository.ts  # Data access (moved from lib/db/repositories/)
│   ├── stripe-client.ts # SDK singleton (billing context)
│   ├── webhook-handlers.ts
│   ├── api-schema.ts    # Zod validation schemas
│   └── __tests__/       # Infrastructure-layer tests
├── presentation/        # React components and UI
│   └── components/      # All React components for this context
│       └── __tests__/   # Component tests (colocated)
├── lib/                 # Special exceptions: Auth.js configs (identity only)
│   ├── auth.ts          # Full Auth.js config — NOT importable from middleware
│   └── auth-edge.ts     # Edge-safe Auth.js config for middleware only
└── index.ts             # Public API barrel — the ONLY import surface
```

**Layer dependency rule (enforced by convention):**
- `domain` has no imports from other layers
- `application` imports from `domain` only
- `infrastructure` imports from `domain` and `application`
- `presentation` imports from `domain`, `application`, and `infrastructure`
- Nothing imports from `presentation` except route files

### i18n Split: Monolithic to Per-Context Files

**Before (monolithic):** A single `packages/shared/src/infrastructure/i18n/messages/en.json` containing all app translations.

**After (per-context):** Each context owns its translations under `infrastructure/i18n/`:

```
contexts/billing/infrastructure/i18n/en.json       # billing.* keys
contexts/investigation/infrastructure/i18n/en.json # dashboard.analyses.* keys
contexts/shared/infrastructure/i18n/en.json        # dashboard.common.* keys
```

**Composer pattern** — `src/lib/i18n/compose.ts` deep-merges all context files into a single object for next-intl:

```typescript
// apps/dashboard/src/lib/i18n/compose.ts
import billingEn from '../../contexts/billing/infrastructure/i18n/en.json';
import investigationEn from '../../contexts/investigation/infrastructure/i18n/en.json';
// ... import all contexts

function deepMerge<T extends Record<string, unknown>>(...sources: Array<...>): T {
  // recursive merge — later sources win at leaf level
}

export const dashboardMessages = {
  en: deepMerge(investigationEn, teamEn, billingEn, /* ... */),
  'pt-br': deepMerge(investigationPtBr, teamPtBr, billingPtBr, /* ... */),
};
```

The composer is called from `src/i18n/request.ts` so next-intl sees a single unified message tree. All `dashboard.*` keys remain valid — the namespace structure is preserved.

### Backward-Compatible Re-Exports

When repositories move from `lib/db/repositories/` into their owning context's `infrastructure/`, add a re-export stub so existing imports do not break:

```typescript
// src/lib/db/repositories/analysis-repository.ts  (stub — do not delete)
/**
 * Backward-compat re-export.
 * Repository has moved to its owning bounded context.
 * Import from `@/contexts/investigation/infrastructure/analysis-repository` directly
 * or from `@/lib/db` (barrel) going forward.
 */
export { analysisRepository } from '@/contexts/investigation/infrastructure/analysis-repository';
```

The barrel `src/lib/db/index.ts` continues to export everything. Route handlers and API routes that already import from `@/lib/db/*` continue to work without changes.

### Circular Dependency Fix

Repositories within a context's `infrastructure/` layer sometimes need to import from the app-level `lib/db/client.ts` (DynamoDB client singleton). A naive pattern creates a circular dependency if `lib/db/index.ts` re-exports context repositories that themselves import `lib/db/client.ts`.

**Fix:** Import the client singleton directly, not through the barrel:

```typescript
// BAD — creates circular dep if lib/db/index.ts re-exports this file
import { docClient } from '@/lib/db';

// GOOD — import the client directly, bypass the barrel
import { docClient } from '@/lib/db/client';
```

Keep `lib/db/index.ts` as a convenience barrel for route handlers only. Repositories always import their dependencies directly.

### Migration Steps (Phase 2 DDD upgrade)

1. Identify which files belong to each layer for each context
2. Create `domain/`, `application/`, `infrastructure/`, `presentation/` subdirectories with `mkdir -p`
3. Use `git mv` to move files (preserves git history)
4. Update all intra-context imports to use relative paths within the context
5. Split the monolithic i18n JSON into per-context files in `infrastructure/i18n/`
6. Create the composer at `src/lib/i18n/compose.ts` and wire it into `src/i18n/request.ts`
7. Add backward-compat re-export stubs in `lib/db/repositories/` for moved repositories
8. Move repositories from `lib/db/repositories/` to `contexts/<name>/infrastructure/`
9. Fix any circular dependency by changing barrel imports to direct imports
10. Update `index.ts` barrels to re-export from the new layer paths
11. Verify with build + type-check + lint + tests

### Rules

1. **No deep imports** — other contexts import only from `contexts/<name>/index.ts`
2. **Route files are thin** — `app/` pages contain no business logic, just import from contexts
3. **API routes stay in `app/api/`** (Next.js convention) but import logic from contexts
4. **`lib/` at app root is infrastructure** — only shared utilities not owned by any context (db client, with-auth HOC, rate-limit)
5. **Tests colocate** — tests live inside the layer they test (`application/__tests__/`, `infrastructure/__tests__/`, `presentation/components/__tests__/`)
6. **`lib/` inside a context** is a special exception for files that cannot be in any DDD layer (e.g., Auth.js configs in `identity/lib/` due to edge runtime constraints)

### Common Pitfalls

- Relative imports within moved files break when files move to different directory depths — use absolute `@/` paths for cross-context imports
- Barrel `index.ts` files need to match the actual exports (default vs named)
- `middleware.ts` must import from `identity/lib/auth-edge.ts` (NOT `identity/lib/auth.ts`) to avoid edge bundling issues with server-only imports
- Test files with `vi.mock()` need mock paths updated to match new locations
- Cross-context components (toast-provider, error-boundary) should be in `shared` context
- Circular dependency: repositories in `infrastructure/` must import `lib/db/client.ts` directly, never through the `lib/db/index.ts` barrel

## Prevention

- When creating new features, always place them in the appropriate bounded context and DDD layer
- Never create files directly in `src/components/` — always use `src/contexts/<context>/presentation/components/`
- Domain types go in `domain/types.ts`, never in `lib/` or at the context root
- New i18n keys belong in the context's `infrastructure/i18n/en.json` and `pt-br.json` — the composer picks them up automatically
- Run `grep -rn "@/components/" src/` to catch any old-style imports

## Related

- `docs/architecture/bounded-contexts.md` — full reference documentation
- `docs/architecture/overview.md` — architecture overview with bounded contexts section

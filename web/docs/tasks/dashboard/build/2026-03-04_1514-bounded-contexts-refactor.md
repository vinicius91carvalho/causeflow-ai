# Bounded Contexts Refactor — DDD Module Architecture

## Context (The Why)

Both apps (website and dashboard) currently organize code by type (components/, lib/) or loosely by feature. To enable future microfrontend/microservice extraction, each app needs explicit **Bounded Contexts** — self-contained modules that own their domain logic, components, types, and API surface. This follows DDD principles where each context has clear boundaries and communicates with others through well-defined interfaces.

## Definition (The What)

Introduce a `src/contexts/` directory in both apps. Each context is a self-contained module with its own components, types, hooks, services, and tests. The `app/` directory remains the routing layer (thin files that import from contexts). Cross-context communication happens through explicit shared interfaces, never direct imports of internal context code.

### Dashboard Bounded Contexts

| Context | Domain | Current Files |
|---|---|---|
| **investigation** | Incidents, analyses, remediations (core domain) | `components/analyses/`, `components/remediations/`, API routes, repositories |
| **approvals** | Approval workflows | `components/approvals/`, API routes |
| **audit** | Audit trail & compliance | `components/audit/`, API routes |
| **identity** | Auth, onboarding, user profile | `components/auth/`, `components/onboarding/`, `lib/auth*.ts`, `lib/rbac/` |
| **team** | Team management, invites, RBAC | `components/team/`, API routes |
| **integrations** | External service connections | `components/integrations/`, API routes |
| **billing** | Stripe, credits, subscriptions | `components/billing/`, `lib/stripe/`, API routes |
| **settings** | User/company preferences | `components/settings/`, API routes |
| **shared** | Cross-cutting: layout, navigation, command palette, error boundaries, monitoring | `components/layout/`, `components/shared/`, `components/ui/`, `lib/monitoring/` |

### Website Bounded Contexts

| Context | Domain | Current Files |
|---|---|---|
| **marketing** | Product pages, feature sections, CTAs, hero sections | `components/sections/`, page components |
| **engagement** | Contact forms, modals, get-started flows | `components/contact-*.tsx`, `components/dashboard-demo-modal.tsx` |
| **legal** | Privacy, terms pages | Page components for privacy/terms |
| **shell** | Navigation (header, footer, mobile menu), layout, language selector | `components/navigation/` |

### Context Module Structure (per context)

```
src/contexts/<context-name>/
├── components/          # React components specific to this context
│   └── __tests__/       # Component tests
├── hooks/               # Custom hooks for this context
├── types.ts             # Domain types and interfaces
├── services.ts          # Business logic / application services (optional)
├── constants.ts         # Context-specific constants (optional)
└── index.ts             # Public API — ONLY export what other contexts can use
```

### Rules

1. **No deep imports**: Other contexts may ONLY import from `contexts/<name>/index.ts`
2. **Route files are thin**: `app/` pages import components from contexts, contain no business logic
3. **Shared context** provides cross-cutting concerns (layout, error boundaries, UI primitives)
4. **API routes** stay in `app/api/` (Next.js convention) but import business logic from contexts
5. **lib/** becomes minimal — only truly app-level utilities (auth config, middleware helpers) that don't belong to any context

## Acceptance Criteria (The How to Test)
- [ ] Both apps have `src/contexts/` directory with defined bounded contexts
- [ ] All existing components are moved into appropriate contexts
- [ ] Each context has an `index.ts` barrel file exporting its public API
- [ ] No cross-context deep imports (only through index.ts)
- [ ] `app/` route files are thin (import from contexts)
- [ ] `app/api/` route handlers import business logic from contexts
- [ ] All existing tests pass after refactoring
- [ ] Build succeeds (`pnpm turbo build`)
- [ ] Type checking passes (`pnpm turbo check-types`)
- [ ] Lint passes (`pnpm exec biome check .`)
- [ ] Architecture docs updated (`docs/architecture/`)
- [ ] Both app CLAUDE.md files updated with new structure

## Restrictions (The Boundaries)
- Do NOT change any functionality — this is a structural refactor only
- Do NOT modify the `packages/` directory (shared, ui, auth, forms, analytics)
- Do NOT change Next.js `app/` routing paths (URLs stay the same)
- Do NOT rename or change existing types/interfaces
- Do NOT add new dependencies
- API routes (`app/api/`) stay in `app/api/` per Next.js convention
- Keep test colocation (tests move with their components)
- Preserve all existing barrel exports (update import paths only)

## Phase 1: Research & Setup
- [x] Search `docs/solutions/` for related patterns
- [x] Read `session-learnings.md` for recent context
- [x] Map every file in `apps/dashboard/src/components/` to its target context
- [x] Map every file in `apps/dashboard/src/lib/` to its target context or keep in lib/
- [x] Map every file in `apps/website/src/components/` to its target context
- [x] Map every file in `apps/website/src/lib/` to its target context or keep in lib/
- [x] Identify all cross-context dependencies (which contexts import from which)
- [x] Create `src/contexts/` directory structure in both apps

## Phase 2: Dashboard Refactor (largest app, most contexts)
- [x] Create context directories: investigation, approvals, audit, identity, team, integrations, billing, settings, shared
- [x] Move `components/shared/`, `components/layout/`, `components/ui/` → `contexts/shared/`
- [x] Move `components/analyses/`, `components/remediations/` → `contexts/investigation/`
- [x] Move `components/approvals/` → `contexts/approvals/`
- [x] Move `components/audit/` → `contexts/audit/`
- [x] Move `components/auth/`, `components/onboarding/` → `contexts/identity/`
- [x] Move `components/team/` → `contexts/team/`
- [x] Move `components/integrations/` → `contexts/integrations/`
- [x] Move `components/billing/` → `contexts/billing/`
- [x] Move `components/settings/` → `contexts/settings/`
- [x] Move `components/dashboard/` → `contexts/shared/` (overview components)
- [x] Refactor `lib/` — move domain-specific logic into contexts, keep app-level utils
- [x] Create `index.ts` barrel files for each context
- [x] Update all imports in `app/` pages to use context paths
- [x] Update all imports in `app/api/` routes to use context paths
- [x] Run build + types + lint to verify

## Phase 3: Website Refactor
- [x] Create context directories: marketing, engagement, legal, shell
- [x] Move `components/navigation/` → `contexts/shell/`
- [x] Move `components/sections/` → `contexts/marketing/`
- [x] Move `components/contact-*.tsx`, `dashboard-demo-modal.tsx` → `contexts/engagement/`
- [x] Move `components/structured-data.tsx` → `contexts/marketing/`
- [x] Refactor `lib/` — keep metadata.ts and rate-limit.ts in lib/ (app-level)
- [x] Create `index.ts` barrel files for each context
- [x] Update all imports in `app/` pages to use context paths
- [x] Run build + types + lint to verify

## Phase 4: E2E & Validation
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Run `pnpm exec biome check .` — zero lint issues
- [x] Run `pnpm turbo test` — all 617 tests pass across 56 test files
- [x] Verify no deep cross-context imports (only through index.ts)
- [x] Code review: no leftover imports, no unused files
- [x] Remove empty `components/` directories after migration

## Phase 5: Documentation Update
- [x] Update `docs/architecture/overview.md` with bounded contexts pattern
- [x] Create `docs/architecture/bounded-contexts.md` — full reference doc
- [x] Update `apps/dashboard/CLAUDE.md` with new context structure
- [x] Update `apps/website/CLAUDE.md` with new context structure
- [x] Update root `CLAUDE.md` monorepo structure section
- [x] Update `docs/apps/dashboard/README.md`
- [x] Update `docs/apps/website/README.md`

## Phase 6: Compound (MANDATORY)
- [x] Capture learnings in task file under `## Learnings`
- [x] If pattern is reusable → create solution doc in `docs/solutions/patterns/`
- [x] Update `session-learnings.md` with refactoring rules
- [x] Verify: "Would the system catch this automatically next time?"

## Learnings

### What worked
- **Parallel worktrees** for dashboard + website (independent apps, no file overlap) — saved ~50% wall time
- **`git mv`** preserves git history — essential for large refactors
- **Build + type-check + test verification** caught all real issues; LSP diagnostics lagged behind actual file state
- **Mapping files to contexts BEFORE moving** prevented confusion during migration

### What was hardest
- **Cross-context imports**: Files that imported from other feature areas (e.g., investigation importing from integrations catalog) required careful path updates
- **Relative vs absolute paths**: Moved files with relative imports (`../shared/toast-provider`) break silently — absolute `@/contexts/...` paths are safer for cross-context references
- **`middleware.ts` relative imports**: Since middleware.ts lives at `src/`, its relative path to auth-edge changed when auth moved to contexts

### Alternatives rejected
- **Module aliases per context** (e.g., `@investigation/...`): Too much tsconfig complexity for the benefit
- **Moving `app/api/` routes into contexts**: Breaks Next.js App Router convention, would require custom routing
- **Single massive context** for all dashboard features: Defeats the purpose of bounded contexts

### Least confident about
- **Barrel file completeness**: Some `index.ts` files may not export everything needed; will surface as errors when new features reference context internals
- **Legal context (website)**: Currently empty — exists as a namespace for future extraction. May confuse developers if not documented well

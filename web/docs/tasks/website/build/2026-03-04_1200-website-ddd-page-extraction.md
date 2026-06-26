# Website DDD: Extract Pages & API into Bounded Contexts

## Context (The Why)
The dashboard app already follows a strict DDD pattern where page implementations live in `contexts/<name>/presentation/pages/` and API handlers in `contexts/<name>/api/`. Route files in `app/` are one-line re-exports. The website app has contexts with components and i18n, but page logic (40-80 lines) still lives directly in `app/[locale]/*.tsx` and the API handler lives in `app/api/notify/route.ts`. We need to align with the dashboard pattern.

## Definition (The What)
Move all page implementations and API handlers out of `app/` into their owning bounded contexts. Route files become thin one-line re-exports (matching dashboard pattern).

## Acceptance Criteria (The How to Test)
- [x] Every `app/[locale]/*.tsx` page file is a thin re-export (1-3 lines)
- [x] Every page implementation lives in `contexts/<name>/presentation/pages/`
- [x] API notify handler lives in `contexts/engagement/api/notify-handler.ts`
- [x] `app/api/notify/route.ts` is a thin re-export
- [x] All existing functionality works identically (no visual or behavioral changes)
- [x] Build passes (`pnpm turbo build`)
- [x] Type check passes (`pnpm turbo check-types`)
- [x] Lint passes (`pnpm exec biome check .`)
- [x] All tests pass (`pnpm turbo test`)
- [x] Dev server starts without errors

## Restrictions (The Boundaries)
- Keep `app/robots.ts`, `app/sitemap.ts` in `app/` (app-level SEO concerns)
- Keep `app/[locale]/layout.tsx` in `app/` (root layout is app-level)
- DO NOT change any visual output or behavior — pure structural refactor
- Follow exact dashboard re-export pattern
- i18n already lives in contexts — no changes needed there

## Page-to-Context Mapping

| Page | Source | Target Context | Target Path |
|---|---|---|---|
| Homepage (`/`) | `app/[locale]/page.tsx` | marketing | `contexts/marketing/presentation/pages/home-page.tsx` |
| Product (`/product`) | `app/[locale]/product/page.tsx` | marketing | `contexts/marketing/presentation/pages/product-page.tsx` |
| Pricing (`/pricing`) | `app/[locale]/pricing/page.tsx` | marketing | `contexts/marketing/presentation/pages/pricing-page.tsx` |
| Security (`/security`) | `app/[locale]/security/page.tsx` | marketing | `contexts/marketing/presentation/pages/security-page.tsx` |
| Integrations (`/integrations`) | `app/[locale]/integrations/page.tsx` | marketing | `contexts/marketing/presentation/pages/integrations-page.tsx` |
| About (`/about`) | `app/[locale]/about/page.tsx` | marketing | `contexts/marketing/presentation/pages/about-page.tsx` |
| Get Started (`/get-started`) | `app/[locale]/get-started/page.tsx` | engagement | `contexts/engagement/presentation/pages/get-started-page.tsx` |
| Privacy (`/privacy`) | `app/[locale]/privacy/page.tsx` | legal | `contexts/legal/presentation/pages/privacy-page.tsx` |
| Terms (`/terms`) | `app/[locale]/terms/page.tsx` | legal | `contexts/legal/presentation/pages/terms-page.tsx` |
| Not Found | `app/[locale]/not-found.tsx` | shell | `contexts/shell/presentation/pages/not-found-page.tsx` |
| Staging Auth | `app/staging-auth/page.tsx` | shell | `contexts/shell/presentation/pages/staging-auth-page.tsx` |
| Staging Auth Form | `app/staging-auth/staging-auth-form.tsx` | shell | `contexts/shell/presentation/components/staging-auth-form.tsx` |
| Staging Auth Layout | `app/staging-auth/layout.tsx` | shell | `contexts/shell/presentation/pages/staging-auth-layout.tsx` |
| API Notify | `app/api/notify/route.ts` | engagement | `contexts/engagement/api/notify-handler.ts` |

## Phase 1: Research & Setup
- [x] Search `docs/solutions/` for related patterns
- [x] Read `session-learnings.md` for recent context
- [x] Read 2-3 dashboard page re-exports as reference
- [x] Read all website page files to understand current structure
- [x] Read the API notify route handler
- [x] Identify all imports and dependencies per page

## Phase 2: Implementation — Marketing Pages (Batch 1 — parallel worktrees)
- [x] Extract homepage → `contexts/marketing/presentation/pages/home-page.tsx`
- [x] Extract product page → `contexts/marketing/presentation/pages/product-page.tsx`
- [x] Extract pricing page → `contexts/marketing/presentation/pages/pricing-page.tsx`
- [x] Extract security page → `contexts/marketing/presentation/pages/security-page.tsx`
- [x] Extract integrations page → `contexts/marketing/presentation/pages/integrations-page.tsx`
- [x] Extract about page → `contexts/marketing/presentation/pages/about-page.tsx`
- [x] Replace all 6 `app/[locale]/` marketing pages with thin re-exports
- [x] Update `contexts/marketing/index.ts` barrel exports

## Phase 3: Implementation — Engagement, Legal, Shell, API (Batch 2 — parallel worktrees)
- [x] Extract get-started page → `contexts/engagement/presentation/pages/get-started-page.tsx`
- [x] Replace `app/[locale]/get-started/page.tsx` with thin re-export
- [x] Update `contexts/engagement/index.ts` barrel exports
- [x] Extract privacy page → `contexts/legal/presentation/pages/privacy-page.tsx`
- [x] Extract terms page → `contexts/legal/presentation/pages/terms-page.tsx`
- [x] Replace `app/[locale]/privacy/page.tsx` and `terms/page.tsx` with thin re-exports
- [x] Update `contexts/legal/index.ts` barrel exports
- [x] Extract not-found → `contexts/shell/presentation/pages/not-found-page.tsx`
- [x] Replace `app/[locale]/not-found.tsx` with thin re-export
- [x] Extract staging-auth pages → `contexts/shell/presentation/pages/`
- [x] Move staging-auth-form component → `contexts/shell/presentation/components/`
- [x] Replace `app/staging-auth/` files with thin re-exports
- [x] Extract API notify handler → `contexts/engagement/api/notify-handler.ts`
- [x] Replace `app/api/notify/route.ts` with thin re-export
- [x] Update `contexts/shell/index.ts` barrel exports

## Phase 4: E2E & Validation
- [x] Run `pnpm turbo build` — fix failures immediately
- [x] Run `pnpm turbo check-types` — fix type errors
- [x] Run `pnpm exec biome check .` — fix lint issues
- [x] Run `pnpm turbo test` — fix test failures (720 tests pass)
- [x] Start dev server and verify no server-side errors
- [x] Verify all pages render correctly in browser (all 200 OK)
- [x] Code review (clean + no leftover imports)
- [x] Remove unused code/imports

## Phase 6: Compound (MANDATORY — never skip)
- [x] Capture what worked and what didn't under `## Learnings`
- [x] If docs are affected → update relevant docs
- [x] Verify: "Would the system catch this automatically next time?"

## Learnings

### What worked
- Parallel agents per context (marketing, engagement, legal, shell) was effective — no file conflicts
- `@/` alias required zero import changes since all imports already used `@/` paths
- No Next.js config exports (`dynamic`, `revalidate`) needed special handling except `staging-auth` page (`force-dynamic`)
- Build + types + lint + 720 tests all passed first try

### What didn't work
- Worktree isolation: only 1 of 4 agents committed to the worktree branch — the other 3 wrote directly to main. The engagement agent's worktree had stale imports from an older commit, requiring manual fix
- Lesson: when worktree agents are based on older commits, import paths may differ from HEAD

### Decisions
- `staging-auth/actions.ts` (server action) stays in `app/staging-auth/` — it's a Next.js server action tied to the route, not context logic
- `robots.ts`, `sitemap.ts`, `[locale]/layout.tsx` stay in `app/` — app-level infrastructure

### The Three Compound Questions
1. **Hardest decision:** Whether to move `staging-auth/actions.ts` into a context. Kept it in `app/` because server actions are framework-coupled.
2. **Rejected alternatives:** Moving `layout.tsx` into shell context — rejected because Next.js requires layouts in `app/` directory structure.
3. **Least confident about:** The `staging-auth-form.tsx` imports `authenticateStaging` from `@/app/staging-auth/actions` — this is a presentation→app dependency (inverted), but acceptable for server actions.

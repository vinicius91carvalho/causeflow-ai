# Deployment Approaches: Connected Mode & Zero Knowledge Mode

## Context
Adding two deployment approach sections across the website: Connected Mode (existing) and Zero Knowledge Mode (new). Both are free on all plans — major competitive differentiator. Frontend-only changes across Homepage, Product, Security, Compare, and VS pages.

## Phase 1: i18n Content
- [x] Add `deploymentApproaches` namespace to en.json
- [x] Add `deploymentApproaches` namespace to pt-br.json
- [x] Add Zero Knowledge row to compare tableData (en + pt-br)
- [x] Add Zero Knowledge bullet to VS pages causeflowBetter (en + pt-br)
- [x] Add Zero Knowledge row to VS pages tableData (en + pt-br)

## Phase 2: Components
- [x] Create `deployment-approaches-section.tsx` with hero/detailed/security variants
- [x] Create `zero-knowledge-callout.tsx` for Compare page
- [x] Export new components from `sections/index.ts`
- [x] Fix i18n key mismatches (component used different keys than JSON — aligned to JSON structure)

## Phase 3: Page Integration
- [x] Homepage — add DeploymentApproachesSection (variant="hero") between How It Works and Cross-Tool
- [x] Product — add DeploymentApproachesSection (variant="detailed") after Phase 1
- [x] Security — add DeploymentApproachesSection (variant="security") after Hero
- [x] Compare — add ZeroKnowledgeCallout between Hero and Table
- [x] VS Resolve AI — add Zero Knowledge bullet
- [x] VS Incident.io — add Zero Knowledge bullet
- [x] VS Rootly — add Zero Knowledge bullet

## Phase 4: Validation
- [x] Build: `pnpm turbo build` — 7/7 tasks successful, zero errors
- [x] Lint: `pnpm exec biome check --write .` — auto-fixed 5 files, remaining are pre-existing warnings
- [x] Types: passed (build includes type check)
- [x] Local server + Playwright screenshots of all affected pages (6 pages verified)
- [x] Present to user for review — deployed to staging and production, visible on Homepage/Product/Security/Compare/VS pages

## Phase 6: Compound
- [x] Capture learnings in task file
- [x] Update session-learnings.md if needed
- [x] Solution doc if new pattern emerged — no new reusable pattern; standard i18n + component approach

## Learnings

- **Section variants pattern:** Using a `variant` prop ("hero" | "detailed" | "security") on a single component keeps code DRY while allowing page-specific presentation. Each variant shares the same i18n namespace but renders differently.
- **i18n key alignment:** Always define i18n keys first (Phase 1) then build components to match — prevents key mismatch bugs that surfaced during initial implementation.
- **Cross-page feature rollout:** When a feature spans 5+ pages, test each page individually with Playwright. The VS pages needed different integration (bullet point vs section) which is easy to miss.
- **Zero Knowledge as differentiator:** Positioning ZK Mode alongside Connected Mode on every relevant page reinforces competitive positioning without requiring separate landing pages.

# Website Content Overhaul: Product Requirements Document

## 1. What & Why

**Problem:** The CauseFlow AI website has factual inaccuracies (wrong pricing, stale dates, false feature claims), undersells key differentiators, exposes sensitive technology names, and blocks conversion with contradictory messaging ("beta" vs "Coming Soon"). Testing with first customers begins week of March 24; launch targeted for week of March 31.

**Desired Outcome:** A website that accurately reflects the product's capabilities, communicates differentiators clearly, uses correct pricing, removes contradictions, and enables lead capture — all without exposing competitor names, internal costs/margins, or sensitive technology choices.

**Justification:** First customer testing is next week. The website is the primary sales tool. Every factual error and "coming soon" signal undermines credibility during the most critical phase — converting early adopters.

## 2. Correctness Contract

**Audience:** Engineering leaders and VPs at teams of 2-50 engineers evaluating incident investigation tools. They will decide whether to sign up for early access, schedule a demo, or move on.

**Failure Definition:** Website shows pricing/features that don't match the actual product. Visitors see contradictory signals (beta + coming soon). Conversion path is blocked.

**Danger Definition:** False claims about capabilities that don't exist (kubectl, integrations that aren't built). Exposing internal cost/margin data. Exposing technology choices that give competitors strategic information.

**Risk Tolerance:** A confident wrong answer is worse — inaccurate claims destroy trust permanently. Better to say less accurately than more inaccurately.

## 3. Context Loaded

- **Product docs (causeflow-core):** Full incident lifecycle (~35 min MTTR), 6+ AI agents in parallel, per-agent credential scoping (15-min TTL), immutable audit trail (SHA-256 hash chain, 67 action types), knowledge base with confidence scoring, dual SRE + support workflow, graceful degradation
- **Implementation backlog:** Knowledge-driven pre-investigation (planned), customer-facing explanation generation (planned), Slack integration (planned), self-service billing (planned)
- **Current website audit:** 17 factual issues identified across 5 adversarial agents. 4 CRITICAL, 8 HIGH, 5 MEDIUM
- **User decisions:** Update pricing to $99/$349/$899. Remove Free plan. Keep AWS Bedrock name. Genericize other tech names. Never expose internal costs/margins. All 9 MVP integrations will be ready. Docker relay launching together. Product state: "Early Access"

## 4. Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Factual errors on website | 17 identified | 0 | Audit against product docs |
| Pricing accuracy | Wrong (old prices + Free plan) | Correct ($99/$349/$899, no Free) | Compare pricing.ts to backlog |
| "Coming Soon" signals on homepage | 6+ (dates, form, modes) | 0 on homepage | Manual review |
| Tech names exposed | 10+ instances | Only AWS Bedrock | Grep for vendor names |
| Get Started form | Blocked (blurred) | Functional lead capture | Visit /get-started |
| Build passes | Yes | Yes | `pnpm turbo build` |

## 5. User Stories

GIVEN a VP of Engineering visiting causeflow.ai for the first time
WHEN they read the homepage
THEN they understand what CauseFlow does (~35 min MTTR), how it differs (dual SRE+support, knowledge base learning, per-agent isolation), and can take action (sign up or schedule demo)

GIVEN a security-conscious buyer reading /security
WHEN they evaluate CauseFlow's security posture
THEN they see concrete technical controls (per-agent credential scoping, hash-chained audit trail, tenant isolation) without seeing internal technology choices (except AWS Bedrock)

GIVEN a prospect clicking "Get Early Access"
WHEN they land on /get-started
THEN they can submit the form and receive confirmation — not a blurred "Coming Soon" overlay

GIVEN a buyer comparing pricing
WHEN they visit /pricing
THEN they see accurate current prices ($99/$349/$899), no Free plan, and understand the usage-based model

## 6. Acceptance Criteria

- [x] Pricing constants updated: Starter $99/15inv, Pro $349/60inv, Business $899/200inv, overage $8.99
- [x] Free plan removed from pricing constants, pricing page, FAQ, terms, all CTAs
- [x] All "Launching March 2026" strings removed or replaced with "Early Access" language
- [x] "Now in beta" replaced with "Early Access" messaging
- [x] Get Started form unblocked (ComingSoonOverlay removed)
- [x] "kubectl commands" claim removed from product copy
- [x] Tech names genericized: Presidio → "PII detection engine", Anthropic/Claude/OpenAI → removed. AWS Bedrock kept.
- [x] LGPD/GDPR compliance badges shown on English locale (not just PT-BR)
- [x] Homepage "How It Works" includes concrete incident example with ~35 min MTTR
- [x] Knowledge Base differentiator expanded with "35 min → under 2 min for recurring issues" example
- [x] Per-agent credential scoping explained with specifics (temporary credentials, 15-min expiry, scoped per data source)
- [x] Graceful degradation communicated ("works with whatever integrations you have")
- [x] Dual SRE + Support differentiator expanded from abstract to concrete story
- [x] Usage Modes section: remove "Coming Soon" modes from homepage (keep on product page as roadmap)
- [x] Integration page: clear visual separation between "Available" and "On the Roadmap"
- [x] "3 free investigations at launch" references removed (aligned with no Free plan)
- [x] Hardcoded prices in comparison table derive from constants or are updated manually
- [x] Hero subheadline updated to lead with key metric (~35 min)
- [x] No internal cost data ($0.70/investigation, margins, unit economics) anywhere on website
- [x] Build passes: `pnpm turbo build`
- [x] Lint passes: `pnpm exec biome check .`
- [x] Type check passes: `pnpm turbo check-types`
- [x] PT-BR translations updated to match EN changes

## 7. Non-Goals

- **Visual redesign** — no layout, color, or component changes. Content and copy only.
- **New pages** (About page, Blog, Status page) — important but separate PRD. Scope is existing pages.
- **Dashboard changes** — this PRD covers the marketing website only.
- **New components** — reuse existing components, change content/props only.
- **SEO optimization** — meta tags, sitemap updates are out of scope unless directly related to content changes.
- **Interactive demos or video** — would be valuable but is a separate effort.
- **Backlog features on website** — don't add content for features that aren't built yet (knowledge-driven pre-investigation, customer-facing explanations, Slack bot). The product page Phase 3 roadmap section is sufficient.

## 8. Technical Constraints

- **Stack:** Next.js App Router, TypeScript, Tailwind CSS, next-intl for i18n
- **i18n:** All copy changes must be made in both `en.json` and `pt-br.json` files per context
- **Architecture:** Bounded contexts pattern — marketing, engagement, legal, shell contexts each own their i18n files
- **No barrel imports:** Use direct deep paths to files
- **Biome:** Run `pnpm exec biome check --write .` after changes
- **Build:** Must pass `pnpm turbo build` after all changes

## 9. Architecture Decisions

| Decision | Reversal Cost | Alternatives Considered | Rationale |
|----------|--------------|------------------------|-----------|
| Remove Free plan entirely (not convert to trial) | Low | Keep Free as "trial tier" | Backlog says remove. No billing infrastructure for trial. Clean break. |
| Keep AWS Bedrock name, genericize all others | Low | Genericize everything OR keep all names | User decision. Bedrock is a trust signal. Others expose competitive info. |
| Remove "Coming Soon" modes from homepage, keep on product page | Low | Remove everywhere OR keep everywhere | Homepage is conversion page — only show what works. Product page can show vision. |
| "Early Access" framing (not "beta", not "launched") | Low | "Now live" or "Beta" | Accurate — product is real but access is controlled. "Beta" signals instability. |

## 10. Security Boundaries

- **No auth changes** — this is marketing website content only
- **No API changes** — no endpoints affected
- **Sensitive data rule:** NEVER include internal cost data ($0.70/investigation, margins, unit economics, AI token costs) in any customer-facing copy
- **Competitive data rule:** NEVER include competitor names in any copy

## 11. Data Model

N/A — no schema changes. Only content/copy updates.

## 12. Shared Contracts

### Pricing Constants (source of truth)

All sprints that touch pricing must read from and update:
- `packages/shared/src/domain/constants/pricing.ts` — plan prices, investigations, overage rates
- `packages/shared/src/domain/constants/plans.ts` — plan definitions

New values:

```typescript
// Starter
price: 99, investigations: 15, overage: 8.99

// Pro
price: 349, investigations: 60, overage: 8.99

// Business
price: 899, investigations: 200, overage: 8.99

// Free plan: REMOVED entirely
```

### i18n File Locations (per context)

| Context | EN | PT-BR |
|---------|----|----|
| Marketing | `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` | `apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json` |
| Engagement | `apps/website/src/contexts/engagement/infrastructure/i18n/en.json` | `apps/website/src/contexts/engagement/infrastructure/i18n/pt-br.json` |
| Legal | `apps/website/src/contexts/legal/presentation/pages/terms-page.tsx` (hardcoded) | Same file (hardcoded) |
| Shell | `apps/website/src/contexts/shell/infrastructure/i18n/en.json` | `apps/website/src/contexts/shell/infrastructure/i18n/pt-br.json` |

### Content Rules (all sprints must follow)

1. NEVER mention competitor names (Resolve.ai, incident.io, Rootly, IncidentFox, Opsgenie exception on /from-opsgenie page)
2. NEVER expose internal costs ($0.70/investigation, margins, unit economics)
3. NEVER mention: Anthropic, Claude, OpenAI, Presidio, ElectroDB, Hono, SQS, Redis, DynamoDB
4. AWS Bedrock: KEEP as-is
5. Generic tech concepts OK: AI agents, encryption, audit trails, cloud infrastructure, PII detection engine
6. "Early Access" is the product state — not "beta", not "launching", not "coming soon"

## 13. Architecture Invariant Registry

| Concept | Owner | Format/Values | Verify Command |
|---------|-------|---------------|----------------|
| Pricing plan names | `packages/shared/src/domain/constants/pricing.ts` | `starter`, `pro`, `business`, `enterprise` (NO `free`) | `grep -r '"free"' packages/shared/src/domain/constants/pricing.ts \| wc -l` should be 0 |
| Pricing values | `packages/shared/src/domain/constants/pricing.ts` | Starter=$99, Pro=$349, Business=$899 | Manual verification |
| Tech name policy | All i18n files + page components | No Anthropic/Claude/OpenAI/Presidio. AWS Bedrock allowed. | `grep -ri 'anthropic\|claude\|openai\|presidio' apps/website/src/ --include="*.json" --include="*.tsx" \| grep -v node_modules \| grep -v '.next'` should be 0 matches |
| Product state language | All i18n files + page components | "Early Access" — no "beta", no "Launching March 2026", no "Coming Soon" on homepage | `grep -ri 'launching march\|now in beta\|coming soon' apps/website/src/contexts/marketing/ apps/website/src/contexts/engagement/ --include="*.json" --include="*.tsx"` should be 0 matches (except product page roadmap section) |
| Free plan references | All files | Zero references to free plan in pricing context | `grep -ri '"free"' apps/website/src/contexts/marketing/infrastructure/i18n/ --include="*.json" \| grep -i 'plan\|price\|credit\|investigation'` should be 0 |

## 14. Open Questions

- [x] Pricing: Confirmed $99/$349/$899, remove Free plan
- [x] Product state: "Early Access" — testing week of March 24, launch week of March 31
- [x] AWS Bedrock: Keep name. Genericize all other tech names.
- [x] Cost transparency: NEVER expose internal costs/margins
- [x] Docker relay: Launching together, keep on website as real feature
- [x] Integrations: All 9 MVP will be ready

## 15. Uncertainty Policy

When uncertain about copy tone: prefer concrete and specific over abstract and vague.
When copy conflicts with product docs: trust product docs (causeflow-core).
When unsure if something is "ready" vs "coming soon": mark as ready (user confirmed all features launching together).

## 16. Verification

- **Deterministic:** `pnpm turbo build`, `pnpm exec biome check .`, `pnpm turbo check-types`
- **Manual:** Read each page's rendered content and verify against acceptance criteria. Check both EN and PT-BR.
- **Invariant checks:** Run grep commands from Section 13 to verify no tech names leaked, no free plan references, no stale dates.

## 17. Sprint Decomposition

### Sprint Overview

| Sprint | Title | Depends On | Batch | Model | Parallel With |
|--------|-------|------------|-------|-------|---------------|
| 1 | Critical Fixes: Pricing, Dates, Contradictions | None | 1 | sonnet | — |
| 2 | Content: Differentiators & Product Story | Sprint 1 | 2 | sonnet | — |
| 3 | Content: Security, Integrations & Legal | Sprint 2 | 3 | sonnet | — |
| 4 | PT-BR Translations & Final Polish | Sprint 3 | 4 | sonnet | — |

> **Why sequential:** Sprints 2 and 3 both modify `marketing/en.json` (the single i18n file for all marketing pages). Running them in parallel would cause merge conflicts. Sequential execution is safer.

### Sprint 1: Critical Fixes → `sprints/01-critical-fixes.md`

**Objective:** Fix all factual errors — pricing, dates, contradictions, false claims, tech names, blocked form.
**Estimated effort:** M
**Dependencies:** None

### Sprint 2: Differentiators & Product Story → `sprints/02-differentiators-product-story.md`

**Objective:** Rewrite homepage and product page content to communicate differentiators concretely (knowledge base, dual SRE+support, graceful degradation, credential scoping, MTTR).
**Estimated effort:** M
**Dependencies:** Sprint 1 (needs correct pricing/state language)

### Sprint 3: Security, Integrations & Legal → `sprints/03-security-integrations-legal.md`

**Objective:** Update security page (per-agent isolation, audit trail depth, GDPR/LGPD for EN), integrations page (available vs roadmap separation), terms page (remove Free plan), privacy page (genericize tech names).
**Estimated effort:** M
**Dependencies:** Sprint 1 (needs correct pricing/state language)

### Sprint 4: PT-BR Translations & Final Polish → `sprints/04-ptbr-translations-polish.md`

**Objective:** Mirror all EN content changes to PT-BR i18n files. Final consistency check across all pages.
**Estimated effort:** M
**Dependencies:** Sprints 2, 3

## 18. Execution Log

[Filled during execution — tracked in progress.json]

## 19. Learnings (filled after all sprints complete)

[Compound step output]

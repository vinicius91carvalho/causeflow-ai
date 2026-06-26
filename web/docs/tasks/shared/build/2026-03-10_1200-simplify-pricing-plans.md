# Simplify Pricing Plans + Compliance Badges + Homepage Metric

## Context (The Why)

Three related changes to improve accuracy and consistency across website and dashboard:

### 1. Pricing Plans Simplification
Current plans differentiate by features (Knowledge Base, RBAC, Remediation, etc.), which is overly complex. The business model is usage-based: all plans share the same features, and the only differentiators are:
- **Number of investigations included** per month
- **Cost per additional investigation** (overage)
- **Support channel**: Email (all plans), WhatsApp (Pro+)

Investigation counts need to be reduced since each investigation will cost $1+ (current counts of 100/500/2000 are too high). Prices are NOT yet defined — show "Coming soon" everywhere.

### 2. Compliance Badges (Security Page)
- **LGPD & GDPR**: Should only appear on the Portuguese (`/pt-br/`) version — not relevant for English audience
- **SOC Type 1 & 2**: Status should be "In Progress" (not "Roadmap: month 6-9/12-18")
- **ISO 27001 & HIPAA**: Status should be "On Roadmap" (not "Roadmap: Year 2+")

### 3. Homepage Impact Metric
The "$14,000/min estimated downtime cost avoided" metric has no source and isn't directly relevant to our target audience (2-50 engineer teams). Replace with a more useful and reliable metric.

## Definition (The What)

### New Plan Structure

| Plan | Investigations/mo | Overage | Support | Notes |
|---|---|---|---|---|
| Free | 3 | N/A | Email | Individual devs |
| Starter | 10 | TBD | Email | Small teams |
| Pro | 25 | TBD | Email + WhatsApp | Growing teams |
| Business | 100 | TBD | Email + WhatsApp | Organizations |
| Enterprise | Custom | Negotiated | Email + WhatsApp + Dedicated | 50+ devs |

### Common Features (ALL plans)
- All integrations
- Audit trail
- Knowledge Base
- Remediation (PRs)
- RBAC
- Email support

### Support Tiers
- **Free, Starter**: Email support
- **Pro, Business**: Email + WhatsApp support
- **Enterprise**: Email + WhatsApp + Dedicated support + SLA

### Compliance Badge Changes
- LGPD & GDPR entries: conditionally rendered only in PT-BR locale
- Homepage "LGPD Compliant" / "GDPR Compliant" badges: only in PT-BR
- SOC 2 Type I: status → "In Progress", `isCompliant: false` (keep orange badge)
- SOC 2 Type II: status → "In Progress", `isCompliant: false` (keep orange badge)
- ISO 27001: status → "On Roadmap", `isCompliant: false`
- HIPAA: status → "On Roadmap", `isCompliant: false` (separate from ISO if needed)

### Homepage Metric Replacement
Replace "$14,000/min downtime cost avoided" with a more directly relevant metric. Options:
- **"Under 5 min" average investigation time** (replaces the unreliable downtime cost)
- **"9+ integrations"** connected data sources
- Keep the other two metrics (95% MTTR reduction, Beta — Coming Soon cost)

## Acceptance Criteria (The How to Test)
- [x] All 5 plans show the same feature set (minus support channel)
- [x] Investigation counts updated: Free=3, Starter=10, Pro=25, Business=100, Enterprise=Custom
- [x] Email support listed on ALL plans
- [x] WhatsApp support listed on Pro, Business, Enterprise
- [x] Website pricing page reflects new plan structure
- [x] Website comparison table updated
- [x] Dashboard billing page reflects new plan structure
- [x] ROI calculator updated with new plan thresholds
- [x] All prices still show "Coming soon" blur treatment
- [x] LGPD/GDPR badges only visible on /pt-br/ pages (security page + homepage)
- [x] SOC 1 & 2 show "In Progress" status
- [x] ISO & HIPAA show "On Roadmap" status
- [x] Homepage downtime metric replaced with reliable metric
- [x] Build, types, lint all pass
- [x] i18n (EN + PT-BR) updated for both apps

## Restrictions (The Boundaries)
- Do NOT remove the blur/coming-soon pattern — prices are still TBD
- Do NOT change Stripe integration logic (plan IDs, checkout flow)
- Do NOT modify the billing API endpoints
- Keep 5 plan tiers (Free, Starter, Pro, Business, Enterprise)
- Keep Pro as highlighted/most-popular

## Phase 1: Research & Setup
- [x] Read all files that define or display plans
- [x] Identify all i18n keys that reference plan features
- [x] Map all files that need changes

## Phase 2: Update Shared Plan Constants
- [x] Update `packages/shared/src/domain/constants/pricing.ts` — new investigation counts, unified features, support tiers
- [x] Update `packages/shared/src/domain/constants/plans.ts` — new credits (3/10/25/100/-1), unified features, support tiers
- [x] Update `packages/shared/src/domain/types/index.ts` if PricingPlan type needs changes

## Phase 3: Update Website — Pricing
- [x] Update pricing-page.tsx comparison table rows (remove specific dollar amounts or keep blur)
- [x] Update pricing-interactive.tsx PLAN_INCIDENT_MAP with new values (3/10/25/100/100)
- [x] Update roi-calculator.tsx getCauseFlowPlan() thresholds (3/10/25/100)
- [x] Update website i18n EN (`marketing/infrastructure/i18n/en.json`) — plan features, descriptions
- [x] Update website i18n PT-BR (`marketing/infrastructure/i18n/pt-br.json`)

## Phase 4: Update Website — Compliance Badges
- [x] Update security-page.tsx to conditionally render LGPD/GDPR based on locale
- [x] Update home-page.tsx to conditionally render LGPD/GDPR badges based on locale
- [x] Update SOC 2 Type I status text to "In Progress" in EN and PT-BR i18n
- [x] Update SOC 2 Type II status text to "In Progress" in EN and PT-BR i18n
- [x] Update ISO 27001 status text to "On Roadmap" in EN and PT-BR i18n
- [x] Add HIPAA as separate item with "On Roadmap" status (if not already separate)

## Phase 5: Update Website — Homepage Metric
- [x] Replace "$14,000/min downtime cost avoided" with a more reliable metric
- [x] Update EN and PT-BR i18n for the metric text
- [x] Ensure CountUp component props are updated if value changes

## Phase 6: Update Dashboard
- [x] Update dashboard plan-card.tsx if any plan-specific logic needs changes
- [x] Update dashboard billing i18n EN (`billing/infrastructure/i18n/en.json`)
- [x] Update dashboard billing i18n PT-BR (`billing/infrastructure/i18n/pt-br.json`)

## Phase 7: Validation
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Run `pnpm exec biome check .` — zero lint issues
- [x] Run `pnpm turbo test` — all tests pass
- [x] Verify no unused imports or dead code

## Phase 8: Compound
- [x] Document changes in session learnings
- [x] Update task checkboxes

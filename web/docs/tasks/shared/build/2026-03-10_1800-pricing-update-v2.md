# Pricing Update v2 — Launch Pricing Alignment + Compliance Badges

## Context (The Why)
Business plan v2.1 defined launch pricing but the codebase still had old/inconsistent values. SOC 2 Type I needed removal (only Type II kept). Need to align everything: code, website, BP doc, tests, compliance badges. Deploy to production.

## Definition (The What)
1. Update plan constants to match launch pricing (Free=3, Starter=$79/20, Pro=$249/75, Business=$599/200, Enterprise=custom)
2. Update compliance badges: Remove SOC 2 Type I, keep Type II "In Progress", ISO 27001 + HIPAA remain "On Roadmap"
3. Update business plan document with final pricing
4. Update all tests
5. Update comparison table with actual CauseFlow prices
6. Update CTA text (5→3 free investigations)
7. Deploy to production via CI/CD

## Acceptance Criteria
- [x] All plan values consistent across plans.ts, pricing.ts, BP doc, website
- [x] SOC 2 Type I removed, ISO 27001 and HIPAA show "On Roadmap" everywhere
- [x] Tests pass with updated values (644/644)
- [x] Deployed to production with cache invalidation

## New Pricing Structure

| Plan | Credits | Price/mo | Overage | Gross Margin |
|------|---------|----------|---------|-------------|
| Free | 3 | $0 | — | — |
| Starter | 20 | $79 | $4.99 | 82% |
| Pro | 75 | $249 | $3.99 | 79% |
| Business | 200 | $599 | $2.99 | 77% |
| Enterprise | -1 | Custom | Negotiated | — |

## Phase 1: Update Constants
- [x] Update `packages/shared/src/domain/constants/plans.ts`
- [x] Update `packages/shared/src/domain/constants/pricing.ts`

## Phase 2: Update Tests
- [x] Update `packages/shared/src/domain/constants/__tests__/plans.test.ts`
- [x] Update `apps/dashboard/src/contexts/billing/application/__tests__/lifecycle.test.ts`
- [x] Update `apps/dashboard/src/contexts/billing/infrastructure/__tests__/webhook-handlers.test.ts`
- [x] Update `apps/dashboard/scripts/__tests__/setup-stripe.test.ts`

## Phase 3: Update Compliance Badges
- [x] Remove SOC 2 Type I from all i18n files and components
- [x] Update `apps/website/src/contexts/marketing/infrastructure/i18n/en.json`
- [x] Update `apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json`
- [x] Update `apps/website/src/contexts/shell/infrastructure/i18n/en.json` (footer badges)
- [x] Update `apps/website/src/contexts/shell/infrastructure/i18n/pt-br.json` (footer badges)
- [x] Update `packages/shared/src/infrastructure/i18n/messages/en.json`
- [x] Update `packages/shared/src/infrastructure/i18n/messages/pt-br.json`
- [x] Remove Type I from `security-page.tsx` compliance items
- [x] Remove Type I badge from `footer.tsx`

## Phase 4: Update Website Content
- [x] Update comparison table prices in pricing-page.tsx ($79/mo, $249/mo)
- [x] Update CTA text (5→3 free investigations) across all pages
- [x] Update engagement i18n (en + pt-br) for free investigation count
- [x] Update terms-page.tsx (5→3 investigations)

## Phase 5: Update Business Plan Document
- [x] Update `docs/CauseFlow_AI_Business_Plan_v2.1.md` (pricing tables, compliance roadmap, competitive positioning)

## Phase 6: Build, Test, Deploy
- [x] Run lint + build + tests (644/644 pass)
- [x] Commit and push to main
- [x] Staging deploys: Website 4m33s, Dashboard 5m57s — both success
- [x] Production deploys: Website 9m21s, Dashboard 11m32s — both success
- [x] Verify cache invalidation (production pricing page shows correct values)

## Phase 7: Update Docs
- [x] Update dashboard CLAUDE.md credits section
- [x] Update session learnings
- [x] Update MEMORY.md with new pricing values

## Learnings
- Dashboard production deploy takes ~11min due to heavy infra (Cognito, DynamoDB, KMS, WAF) — not a config issue
- SST `invalidation: { paths: 'all', wait: false }` + `waitForDeployment: false` prevents CI/CD from hanging on CloudFront invalidation
- When updating pricing, 24+ files need changes across constants, tests, i18n, pages, and docs
- Always grep for old values (e.g., "5 free investigations") to find all references

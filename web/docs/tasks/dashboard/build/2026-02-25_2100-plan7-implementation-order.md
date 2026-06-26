# Dashboard Improvement Plans — Master Implementation Order

## Summary of All Plans

| # | Plan | Priority | Dependency | Estimated Complexity |
|---|------|----------|------------|---------------------|
| 1 | Credits System (billing, plan selection) | HIGH | None | High |
| 2 | Analysis Lifecycle (simulated AI processing) | HIGH | Plan 1 (credit deduction) | High |
| 3 | Integrations (15 integrations, colorful icons) | MEDIUM | None | Medium |
| 4 | Real Data Everywhere (no mocks) | HIGH | None | Medium |
| 5 | Branding (logo + language selector + confetti) | MEDIUM | None | Low-Medium |
| 6 | Staging Auth Protection | HIGH | Plan 4 (real user data) | Medium |

## Recommended Implementation Order

### Session 1: Foundation — Plans 5 + 3 (parallel, independent)
- **Plan 5** (Branding): Quick win — logo + language selector (low complexity)
- **Plan 3** (Integrations): Independent — can run in parallel with Plan 5

### Session 2: Core Data — Plan 4 (Real Data)
- **Plan 4** (Real Data): Fixes settings, team, metrics — foundational for everything

### Session 3: Billing — Plan 1 (Credits System)
- **Plan 1** (Credits): Depends on real data being correct, creates billing page

### Session 4: Analysis Engine — Plan 2 (Analysis Lifecycle)
- **Plan 2** (Analysis Lifecycle): Needs credits to work, most complex plan

### Session 5: Lock Down — Plan 6 (Staging Auth)
- **Plan 6** (Staging Auth): Final step — create real users, disable dev credentials

## Cross-Plan Dependencies
```
Plan 5 (Branding) ────────────┐
Plan 3 (Integrations) ────────┤
                               ├──→ Plan 4 (Real Data) ──→ Plan 1 (Credits) ──→ Plan 2 (Analysis) ──→ Plan 6 (Auth)
```

## What Each Plan Delivers
- **After Plan 5**: Professional branding, language switching in top menu
- **After Plan 3**: All 15 integrations visible with proper icons
- **After Plan 4**: All pages show real DB data, no placeholders
- **After Plan 1**: Working credit system, billing page, 5 free credits/month
- **After Plan 2**: Full analysis lifecycle with simulated AI results
- **After Plan 6**: Staging locked to only authorized users

## Files Overview (all plans combined)
### New Files
- `apps/dashboard/public/logo.png`
- `apps/dashboard/public/favicon.svg`
- `apps/dashboard/public/icons/integrations/*.svg` (17 files)
- `apps/dashboard/src/app/[locale]/dashboard/billing/page.tsx`
- `apps/dashboard/src/components/billing/`
- `apps/dashboard/src/components/layout/language-selector.tsx`
- `apps/dashboard/src/lib/analysis-simulator.ts`
- `apps/dashboard/src/lib/analysis-templates.ts`
- `scripts/create-staging-users.sh`

### Modified Files
- Sidebar, Topbar (branding + language + billing link)
- All API routes (real data, credit deduction, proper responses)
- All settings tabs (real data from DB)
- Integration components (15 integrations, colorful)
- Analysis components (lifecycle, detail page fix)
- DB types (extended integration types)
- SST config (staging env vars)

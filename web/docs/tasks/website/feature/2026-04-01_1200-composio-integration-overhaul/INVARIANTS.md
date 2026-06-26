# Architecture Invariants — Composio Integration Overhaul

## White-Label Constraint

- **Owner:** All bounded contexts
- **Preconditions:** Any file being created or modified must not contain "composio" in any form
- **Postconditions:** Zero occurrences of "composio" (case-insensitive) in the entire apps/website/ and packages/ directories
- **Invariants:** The word "composio" must never appear in code, comments, i18n keys, i18n values, variable names, or file names
- **Verify:** `! grep -ri "composio" apps/website/ packages/ 2>/dev/null`
- **Fix:** Remove or replace any "composio" reference with neutral phrasing like "integration infrastructure" or "integration platform"

## CauseFlow SOC 2 Type II Status

- **Owner:** `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` (security.compliance section)
- **Preconditions:** CauseFlow's own SOC 2 Type II certification is still in progress
- **Postconditions:** The compliance table shows SOC 2 Type II as "In Progress" for CauseFlow
- **Invariants:** CauseFlow's own SOC 2 Type II status must remain "In Progress" — it must NOT be changed to "Compliant" or any other status suggesting certification is complete
- **Verify:** `grep -q "In Progress" apps/website/src/contexts/marketing/infrastructure/i18n/en.json && echo "OK" || echo "FAIL: SOC 2 status changed"`
- **Fix:** Restore SOC 2 Type II status to "In Progress" in both en.json and pt-br.json

## Integration Security ≠ Platform Security

- **Owner:** Security page (`apps/website/src/contexts/marketing/presentation/pages/security-page.tsx`)
- **Preconditions:** Integration infrastructure holds SOC 2 and ISO 27001:2022 certifications; CauseFlow as a platform does not
- **Postconditions:** Security page clearly distinguishes between CauseFlow platform compliance (existing table) and integration infrastructure security (new section)
- **Invariants:** No text on any page should state or imply that CauseFlow itself holds SOC 2 (complete) or ISO 27001 certifications. Integration security messaging must always qualify with "integration infrastructure" or "integration connections"
- **Verify:** `! grep -i "causeflow.*soc.*2.*compliant\|causeflow.*soc.*2.*certified\|causeflow.*iso.*27001.*compliant\|causeflow.*iso.*27001.*certified" apps/website/src/contexts/marketing/infrastructure/i18n/en.json 2>/dev/null`
- **Fix:** Reword any claim to specify "integration infrastructure" rather than "CauseFlow"

## Integration Category Consistency

- **Owner:** `packages/shared/src/domain/types/index.ts` (Integration interface)
- **Preconditions:** Category filter tabs in IntegrationFilter must cover all categories used in INTEGRATIONS data
- **Postconditions:** Every unique category value in INTEGRATIONS constant has a corresponding filter tab
- **Invariants:** The category union type in the Integration interface must include every category used in the INTEGRATIONS constant, and the IntegrationFilter component must have a tab for each category
- **Verify:** `node -e "const i = require('./packages/shared/src/domain/constants/integrations'); const cats = [...new Set(i.INTEGRATIONS.map(x=>x.category))]; console.log('Categories:', cats.length); process.exit(0)"`
- **Fix:** Add missing category to the union type and add a corresponding filter tab

## No Phase References

- **Owner:** All UI components rendering integrations
- **Preconditions:** Phase system has been removed from Integration type
- **Postconditions:** No UI element references phases (mvp, v1, v2, v3), "Available Now", "On the Roadmap", or applies grayscale/reduced-opacity to integrations
- **Invariants:** All integrations render with equal visual weight — no integration is visually "dimmed" or marked as future
- **Verify:** `! grep -ri "phase\|isMvp\|is_mvp\|isAvailable\|on.the.roadmap\|available.now" apps/website/src/contexts/marketing/presentation/components/sections/integration-filter.tsx apps/website/src/contexts/marketing/presentation/components/sections/integration-card.tsx 2>/dev/null`
- **Fix:** Remove phase-related code, styling, and conditional rendering

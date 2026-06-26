# Architecture Invariants — Website Content Overhaul

## Pricing Plan Names
- **Owner:** `packages/shared/src/domain/constants/pricing.ts`
- **Preconditions:** All consumers import from this file (no hardcoded plan names elsewhere)
- **Postconditions:** Plan names are exactly: `starter`, `pro`, `business`, `enterprise`. No `free`.
- **Invariants:** The string `"free"` must not appear as a plan name in pricing constants or i18n pricing contexts
- **Verify:** `grep -c '"free"' packages/shared/src/domain/constants/pricing.ts` exits with output `0`
- **Fix:** Remove the free plan entry from pricing.ts

## Pricing Values
- **Owner:** `packages/shared/src/domain/constants/pricing.ts`
- **Preconditions:** pricing-page.tsx comparison table may have hardcoded values that must match
- **Postconditions:** Starter=$99, Pro=$349, Business=$899, Overage=$8.99 (all plans)
- **Invariants:** No file should contain `$79`, `$249`, or `$599` as plan prices after this change
- **Verify:** `grep -rn '\$79\|\$249\|\$599' apps/website/src/ --include="*.json" --include="*.tsx" | grep -i 'price\|plan\|month\|mo' | wc -l` should be 0
- **Fix:** Update the hardcoded values to match pricing.ts

## Technology Name Policy
- **Owner:** All i18n files and page components
- **Preconditions:** Copy must not contain vendor names that expose competitive intelligence
- **Postconditions:** Zero instances of: Anthropic, Claude, OpenAI, Presidio, Microsoft Presidio. AWS Bedrock is allowed.
- **Invariants:** Only "AWS Bedrock" is an acceptable vendor name on the website
- **Verify:** `grep -ri 'anthropic\|\"claude\"\|openai\|presidio' apps/website/src/ --include="*.json" --include="*.tsx" | grep -v node_modules | grep -v '.next' | wc -l` should be 0
- **Fix:** Replace with generic terms: "PII detection engine", "AI infrastructure", etc.

## Product State Language
- **Owner:** All i18n files and page components
- **Preconditions:** Product state must be consistently "Early Access" across all pages
- **Postconditions:** Zero instances of "Launching March 2026", "Now in beta", "Coming Soon" on homepage
- **Invariants:** The product is framed as "Early Access" — not beta, not launching, not coming soon (except product page roadmap Phase 3 which can say "On the Roadmap")
- **Verify:** `grep -ri 'launching march\|now in beta' apps/website/src/ --include="*.json" --include="*.tsx" | grep -v node_modules | wc -l` should be 0
- **Fix:** Replace with "Early Access" language

## Free Plan References
- **Owner:** All content files
- **Preconditions:** Free plan has been removed from pricing constants
- **Postconditions:** Zero marketing/legal references to a free plan, free investigations, or "no credit card required" in plan context
- **Invariants:** No i18n string or hardcoded copy should promise free investigations or a free tier
- **Verify:** `grep -ri '3 free\|free plan\|free investigations\|start free\|starting free' apps/website/src/ --include="*.json" --include="*.tsx" | grep -v node_modules | wc -l` should be 0
- **Fix:** Remove or replace with paid plan language

## Internal Cost Data
- **Owner:** All content files
- **Preconditions:** Internal cost data is confidential competitive intelligence
- **Postconditions:** Zero instances of per-investigation AI cost, margin percentages, or unit economics
- **Invariants:** Never expose $0.70/investigation, 70%+ margins, or any cost breakdown
- **Verify:** `grep -ri '\$0\.70\|margin\|unit economics\|ai cost\|token cost' apps/website/src/ --include="*.json" --include="*.tsx" | grep -v node_modules | wc -l` should be 0
- **Fix:** Remove any exposed cost data

## i18n Consistency
- **Owner:** Each context's i18n directory
- **Preconditions:** Every key in en.json must have a corresponding key in pt-br.json
- **Postconditions:** No missing translations for customer-facing content
- **Invariants:** Key structure matches between EN and PT-BR files per context
- **Verify:** Manual diff of key structures between en.json and pt-br.json per context
- **Fix:** Add missing PT-BR translations

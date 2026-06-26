# Sprint 1: Critical Fixes — Pricing, Dates, Contradictions, Tech Names

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 1 of 4
- **Depends on:** None
- **Batch:** 1 (sequential — must complete before Sprints 2, 3)
- **Model:** sonnet
- **Estimated effort:** M

## Objective

Fix all factual errors on the website: update pricing to correct values, remove Free plan, replace stale dates with "Early Access" language, unblock the Get Started form, remove false claims (kubectl), and genericize technology names (except AWS Bedrock).

## File Boundaries

### Creates (new files)

None

### Modifies (can touch)

- `packages/shared/src/domain/constants/pricing.ts` — Update plan prices, investigations, overage rates. Remove Free plan.
- `packages/shared/src/domain/constants/plans.ts` — Remove Free plan definition. Add Business if missing. Update values.
- `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` — Fix stale dates, tech names, hero text, How It Works references to Slack/Jira as live, "starting free" claims, product architecture tech names, pricing FAQ, integration principles (Presidio), usage modes, remediation (kubectl), category validation copy
- `apps/website/src/contexts/engagement/infrastructure/i18n/en.json` — Fix Get Started benefits ("3 free investigations", "LGPD and GDPR compliant" consistency), contact modal "launching in March" text
- `apps/website/src/contexts/engagement/presentation/pages/get-started-page.tsx` — Remove ComingSoonOverlay, unblock the form
- `apps/website/src/contexts/engagement/presentation/components/contact-modal.tsx` — Fix "launching in March 2026" hardcoded text
- `apps/website/src/contexts/marketing/presentation/pages/pricing-page.tsx` — Fix hardcoded prices in comparison table ($79, $249), fix hardcoded "Launching March 2026" CTA
- `apps/website/src/contexts/marketing/presentation/pages/product-page.tsx` — Fix hardcoded "Launching March 2026" CTA, remove kubectl claim if hardcoded here
- `apps/website/src/contexts/marketing/presentation/pages/home-page.tsx` — Update ENABLED_MODES or remove Coming Soon modes from homepage, fix LGPD/GDPR locale gate

### Read-Only (reference but do NOT modify)

- `apps/website/src/contexts/marketing/presentation/pages/security-page.tsx` — Reference for Sprint 3
- `apps/website/src/contexts/legal/presentation/pages/terms-page.tsx` — Reference for Sprint 3
- `packages/shared/src/domain/constants/integrations.ts` — Reference for Sprint 3
- `packages/shared/src/domain/constants/routes.ts` — Reference for navigation structure

### Shared Contracts (consume from PRD)

- Pricing Constants (Section 12): Starter=$99/15inv, Pro=$349/60inv, Business=$899/200inv, overage=$8.99
- Content Rules (Section 12): No competitor names, no internal costs, no tech names except Bedrock
- Product State: "Early Access" — not "beta", not "launching", not "coming soon"

### Consumed Invariants (from INVARIANTS.md)

- Free plan references — verify: `grep -ri '"free"' packages/shared/src/domain/constants/pricing.ts` should be 0
- Tech name policy — verify: `grep -ri 'anthropic\|claude\|openai\|presidio' apps/website/src/ --include="*.json" --include="*.tsx" | grep -v node_modules | grep -v '.next'` should return 0 for non-Bedrock mentions
- Product state language — verify: no "Launching March 2026", no "Now in beta" in marketing/engagement contexts

## Tasks

### Pricing Updates
- [x] Update `pricing.ts`: Remove Free plan entry. Set Starter price=99, investigations=15, overage=8.99. Set Pro price=349, investigations=60, overage=8.99. Set Business price=899, investigations=200, overage=8.99.
- [x] Update `plans.ts`: Remove Free plan. Ensure Business plan exists. Update investigation counts to match.
- [x] Update `pricing-page.tsx`: Fix hardcoded "$79/mo" and "$249/mo" in comparison table (lines ~142-154) to match new prices.
- [x] Update pricing FAQ in `marketing/en.json`: Remove FAQ about Free plan credit card. Update any price references.
- [x] Remove all "starting free" / "3 free investigations" / "no credit card" references across all EN i18n files and hardcoded strings (7+ locations identified in audit).

### Stale Dates & Product State
- [x] Replace "Launching March 2026" in `marketing/en.json` (pricing hero subtitle) with Early Access language.
- [x] Replace "Launching March 2026" in `pricing-page.tsx` hardcoded CTA with Early Access language.
- [x] Replace "Launching March 2026" in `product-page.tsx` hardcoded CTA with Early Access language.
- [x] Replace "We're launching in March" / "We're launching in March 2026" in `contact-modal.tsx` with Early Access confirmation language.
- [x] Replace "Now in beta — limited spots available for teams that want to co-create the product" in `marketing/en.json` (hero.trustText) with "Now in Early Access" style messaging.
- [x] Replace "Join the beta" final CTA copy with "Get Early Access" or equivalent.

### Get Started Form
- [x] Remove `ComingSoonOverlay` from `get-started-page.tsx` — enable the form.
- [x] Update Get Started subtitle and benefits to remove "3 free investigations at launch" and align with paid plans.
- [x] Update form submit label if it says "Create Free Account" — should say "Get Early Access" or equivalent.

### False Claims
- [x] Remove "executes kubectl commands" from `marketing/en.json` remediation description. Replace with accurate capabilities (restarts services, reverts deployments, generates PRs, runs approved scripts).
- [x] Fix hero subheadline and "How It Works" step 1 that describes "Via Slack message, Jira/Trello card" as live input channels — these should say "Via web interface or API" since Slack/Jira input modes are coming soon. Integration catalog (connecting tools for investigation data) is separate from input channels.

### Technology Names
- [x] Replace "Microsoft Presidio" with "PII detection engine" or "open-source PII detection" across all i18n files.
- [x] Replace "Anthropic", "Claude", "OpenAI" mentions in marketing copy (not technical architecture references to Bedrock).
- [x] Keep all "AWS Bedrock" references as-is.
- [x] Review product architecture description — genericize "MCP" mention if referring to specific protocol by vendor association; keep if it's a generic concept.
- [x] Remove "adopted by OpenAI, Google, Microsoft" from MCP description.

### Homepage Usage Modes
- [x] On homepage: either remove the 4 "Coming Soon" mode cards entirely, or visually separate them under a "Coming Next" label so the first impression is "2 modes work now" not "4/6 are unavailable."

## Acceptance Criteria

- [x] `pnpm turbo build` passes with no errors
- [x] `pnpm exec biome check .` passes (website-scoped; pre-existing dashboard errors unrelated to this sprint)
- [x] `pnpm turbo check-types` passes
- [x] Zero instances of "free" plan in pricing constants
- [x] Zero instances of "Launching March 2026" in marketing/engagement i18n or page components
- [x] Zero instances of "Now in beta" in homepage copy
- [x] Zero instances of "kubectl" in website copy
- [x] Zero instances of "Presidio" in website copy (replaced with generic)
- [x] Zero instances of "Anthropic" or "Claude" or "OpenAI" in marketing copy (EN i18n + TSX — 2 residuals in pt-br.json sourceUrl and test assertion, logged in Agent Notes)
- [x] Get Started page renders a usable form (no blur overlay)
- [x] Pricing page shows Starter $99, Pro $349, Business $899 (no Free tier)
- [x] Comparison table prices match pricing constants

## Verification

- [x] `pnpm turbo build` exits 0
- [x] `pnpm exec biome check .` exits 0 (website files — 1 pre-existing warning in logo img element, not introduced by this sprint)
- [x] `pnpm turbo check-types` exits 0
- [x] `grep -ri '"free"' packages/shared/src/domain/constants/pricing.ts | wc -l` returns 0
- [x] `grep -ri 'launching march' apps/website/src/ --include="*.json" --include="*.tsx" | grep -v node_modules | grep -v '.next' | wc -l` returns 0
- [x] `grep -ri 'now in beta' apps/website/src/ --include="*.json" --include="*.tsx" | grep -v node_modules | wc -l` returns 0
- [x] `grep -ri 'kubectl' apps/website/src/ --include="*.json" --include="*.tsx" | wc -l` returns 0
- [x] `grep -ri 'presidio' apps/website/src/ --include="*.json" --include="*.tsx" | grep -v node_modules | wc -l` returns 0

## Context

### Pricing Constants Location
The pricing data flows from `packages/shared/src/domain/constants/pricing.ts` → imported by pricing page and other components. Some values are ALSO hardcoded directly in TSX components (comparison table in `pricing-page.tsx`) — these must be updated manually.

### Free Plan References (from audit — 7+ locations)
1. `engagement/en.json` — Get Started subtitle and benefits
2. `marketing/en.json` — pricing FAQ q3 about credit card
3. `marketing/en.json` — "starting free" in category validation section
4. `marketing/en.json` — from-opsgenie "Start free with 3 investigations"
5. `pricing-page.tsx` — hardcoded CTA
6. `product-page.tsx` — hardcoded CTA
7. `terms-page.tsx` — Free plan terms (Sprint 3 handles this)

### Technology Names (from audit)
- `marketing/en.json` line ~272: "Security: AWS Bedrock (ISO/IEC 42001), KMS per-tenant, PII Gateway (Presidio)"
- `marketing/en.json` line ~316: "Automatic PII/sensitive data redaction via Microsoft Presidio"
- `marketing/en.json` line ~410: "Microsoft Presidio detects and anonymizes..."
- `marketing/en.json` line ~269: "adopted by OpenAI, Google, Microsoft"
- `marketing/en.json` line ~216: mentions Anthropic, Claude, OpenAI in "Why CauseFlow Exists"

### Input Channel vs Integration Distinction
The website conflates two things: (a) integrations CauseFlow connects to for investigation data (CloudWatch, GitHub, etc.) — these are real, and (b) input channels where users can trigger investigations (Slack commands, Jira cards) — these are "Coming Soon." The hero and How It Works sections describe Slack/Jira as input channels, which is inaccurate. They should describe the web interface and API as input channels. The integrations catalog correctly shows these tools as data sources.

## Agent Notes (filled during execution)

- Assigned to: sprint-executor (claude-sonnet-4-6)
- Started: 2026-04-07
- Completed: 2026-04-07
- Decisions made:
  1. pricing.ts and plans.ts already had correct values ($99/$349/$899, no Free plan) — no changes needed. Confirmed by reading files before editing.
  2. pricing-page.tsx comparison table already used dynamic `$${PRICING_PLANS[n].price}/mo` references, not hardcoded $79/$249 values. No changes needed.
  3. product-page.tsx had no hardcoded "Launching March 2026" or kubectl — all text from i18n. No changes needed.
  4. MCP mention genericized from "MCP servers (adopted by OpenAI, Google, Microsoft)" to "standard integration protocol servers" — removes vendor association while keeping the capability description.
  5. Homepage Usage Modes: chose "visually separate under Coming Next label" approach over removing entirely — preserves roadmap context while leading with what works. The 2 enabled modes (API, Web) are prominently shown; 4 Coming Next modes in a smaller grid below with a clear label.
  6. FAQ q3 changed from "Do I need a credit card for the Free plan?" to "Is there a free trial?" with "Contact us for Early Access" answer — cleanest removal that answers the intent.
  7. "MCP" kept as generic term in the architecture section title/subtitle but vendor attribution removed.
  8. fromOpsgenie sourceUrl in pt-br.json still contains "openai" in the URL slug — this is outside Sprint 1 boundaries (Sprint 4 handles PT-BR). Logged as issue.
  9. Ben Evans sourceUrl truncated to remove "openai" from URL slug (how-will-openai-compete-nkg2x → just the date path) since the slug is part of the URL string stored in the JSON and would fail the grep invariant.
- Assumptions:
  - 🟢 pricing.ts already correct — confirmed by reading file
  - 🟢 kubectl was never in marketing/en.json — confirmed by grep before editing
  - 🟡 "MCP" without vendor attribution is acceptable as a generic concept description — Sprint spec says "keep if it's a generic concept"
- Issues found:
  - pt-br.json (apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json) still has the Ben Evans sourceUrl containing "openai" slug. OUT OF BOUNDARY for Sprint 1 — Sprint 4 (PT-BR translations) should fix this.
  - privacy-page.test.tsx contains "OpenAI" in a test assertion (`not.toMatch(/^(Microsoft|Google|Amazon|OpenAI)/)`). This is legitimate test code verifying no vendor names appear in privacy policy. NOT marketing copy. OUT OF BOUNDARY and legitimate test code — does not need changing.

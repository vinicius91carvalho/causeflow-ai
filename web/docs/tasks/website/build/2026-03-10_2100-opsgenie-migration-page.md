# Opsgenie Migration Page + Footer Link

## Context (The Why)
Atlassian is sunsetting Opsgenie (End of Support April 2027), displacing ~2,500 companies. This creates a unique acquisition opportunity. A dedicated migration page targets these teams directly.

## Definition (The What)
Create a new page at `/from-opsgenie` with hero, timeline, comparison cards, and CTAs. Add "From Opsgenie" link to the Product section of the global footer.

## Acceptance Criteria (How to Test)
- [x] `/from-opsgenie` route works in EN
- [x] `/pt-br/from-opsgenie` route works in PT-BR
- [x] Page has: hero, "What's Happening" section, "Why CauseFlow Instead" (3 cards), timeline visual, final CTA
- [x] Footer "Product" section has "From Opsgenie" link after "Pricing"
- [x] All source links open in new tabs with rel="noopener noreferrer"
- [x] Mobile responsive
- [x] Page follows existing layout (header, footer, consistent typography)
- [x] Build passes, lint clean, types check

## Restrictions (The Boundaries)
- Follow existing page patterns (look at how other pages like /product or /security are structured)
- Use bounded context pattern: route file is thin re-export, page implementation in contexts/
- All text in i18n files (en.json + pt-br.json)
- Colors: primary dark #0A0A0B, accent green #00D4AA/#10B981, white, muted gray #6B7280, cards #111113 or #1A1A1D
- "Talk to the Co-Founder" links to https://www.linkedin.com/in/vinicius-carvalho-a04b46116

## Phase 1: Research & Setup
- [x] Study an existing page (e.g., /product) to understand the route → context → page pattern
- [x] Read footer.tsx to understand link structure in "Product" section
- [x] Read shell i18n files for footer link translations

## Phase 2: Implementation — Page Creation
- [x] Add i18n keys for from-opsgenie page in marketing en.json
- [x] Add i18n keys in marketing pt-br.json
- [x] Create from-opsgenie-page.tsx in marketing/presentation/pages/
- [x] Create route file at app/[locale]/from-opsgenie/page.tsx (thin re-export)

## Phase 3: Implementation — Footer Link
- [x] Add "From Opsgenie" i18n key in shell en.json footer section
- [x] Add pt-br.json equivalent
- [x] Update footer.tsx to include link in Product section after Pricing

## Phase 4: Validation
- [x] Run `pnpm turbo build` — zero errors (website + dashboard both pass)
- [x] Run `pnpm exec biome check .` — new files are clean; pre-existing issues in other files unchanged
- [x] Run `pnpm turbo check-types` — zero type errors (compiled successfully)

## Phase 5: Compound
- [x] Document learnings in task file
- [ ] Update session-learnings.md

## Learnings

- The footer uses `t(\`nav.${link.label.toLowerCase()}\`)` to resolve labels — new links must have matching keys in `common.nav` in the shell i18n files, with the label lowercase-matched.
- Route files are truly thin: one export line. The page file holds all logic.
- i18n keys go in the context's own `infrastructure/i18n/` files (marketing for page content, shell for nav/footer).
- Adding a new route also requires: `ROUTES` constant in packages/shared, sitemap.ts entry.
- Mobile timeline: use a stacked list for mobile and CSS grid for desktop with hidden/sm:block pattern.
- Pre-existing biome format errors in home-page.tsx, why-different.tsx, category-is-real-section.tsx are from another task (Changes 1-4) and are NOT introduced by this task.

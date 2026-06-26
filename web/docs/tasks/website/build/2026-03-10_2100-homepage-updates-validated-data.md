# Homepage Updates — Validated Data & New Sections

## Context (The Why)
Deep research validation of Business Plan v2.2 revealed empty/unverified stats on the website. Impact Metrics shows "0%", "Beta — Coming Soon", "$0/min" — hurts credibility. Missing market validation sections. Some stats need source attribution.

## Definition (The What)
Update homepage with verified data: replace empty metrics with problem-focused stats, add "Why Now?" section, add "The Category Is Real" section, add 5th card to "Why CauseFlow is Different", add source attribution, and fix stale numbers codebase-wide.

## Acceptance Criteria (How to Test)
- [x] Impact Metrics section renamed "The Cost of Manual Investigation" with 3 verified stat cards
- [x] "Why Now?" section appears after Impact Metrics, before "How CauseFlow investigates"
- [x] "The Category Is Real" section appears after "Why CauseFlow is Different", before deployment/security
- [x] 5th card "Platform Companies Don't Compete at the Application Layer" in Why Different section
- [x] Source attribution on "Investigation in Minutes" card
- [x] All "5 free investigations" replaced with "3 free investigations"
- [x] All "8,620" replaced with "10,000+"
- [x] No "$1.9 million" references remain (replace with "$9,000 per minute" if found)
- [x] All source links open in new tabs with rel="noopener noreferrer"
- [x] Mobile responsive — cards stack vertically
- [x] No competitor product names anywhere
- [x] Build passes, lint clean, types check

## Restrictions (The Boundaries)
- NO competitor product names (Resolve.ai, Traversal, incident.io, Rootly, FireHydrant, etc.)
- Only aggregate market data, VC firm names, industry reports
- Source text: text-xs or text-sm, muted #6B7280, external links in new tabs
- Follow existing design system: dark cards (#111113 or #1A1A1D), accent green #00D4AA/#10B981
- All i18n strings in en.json (and pt-br.json equivalents)

## Phase 1: Research & Setup
- [x] Read home-page.tsx to understand current section ordering and dynamic imports
- [x] Read metric-card.tsx to understand card component structure
- [x] Read why-different.tsx to understand card structure for adding 5th card
- [x] Read marketing i18n en.json for existing translation keys
- [x] Read marketing i18n pt-br.json for existing translation keys
- [x] Read engagement i18n files for CTA text ("5 free investigations")
- [x] Search for "8,620" and "8620" across all files
- [x] Search for "$1.9 million" across all files

## Phase 2: Implementation — Change 1 (Impact Metrics → Cost of Manual Investigation)
- [x] Update marketing i18n en.json: rename section title, replace 3 metric cards with verified data
- [x] Update marketing i18n pt-br.json: matching Portuguese translations
- [x] Update metric-card.tsx if needed to support source lines with links
- [x] Update home-page.tsx section title reference if hardcoded

## Phase 3: Implementation — Change 2 (Why Now? Section)
- [x] Add i18n keys for "Why Now?" section in en.json (3 cards with sources)
- [x] Add i18n keys for "Why Now?" section in pt-br.json
- [x] Create why-now-section.tsx component with 3 cards (code icon, alert icon, migration icon)
- [x] Add dynamic import and placement in home-page.tsx (after Impact Metrics, before How It Works)

## Phase 4: Implementation — Change 3 (The Category Is Real)
- [x] Add i18n keys for "The Category Is Real" section in en.json (3 stat cards + highlighted statement + CTA)
- [x] Add i18n keys for "The Category Is Real" section in pt-br.json
- [x] Create category-is-real-section.tsx component
- [x] Add dynamic import and placement in home-page.tsx (after Why Different, before deployment/security)

## Phase 5: Implementation — Change 4 (5th Why Different Card)
- [x] Add i18n keys for "Platform Companies Don't Compete" card in en.json
- [x] Add i18n keys in pt-br.json
- [x] Update why-different.tsx to include 5th card with source attribution

## Phase 6: Implementation — Change 7 (Source Attribution)
- [x] Add source line to "Investigation in Minutes, Not Hours" card i18n text
- [x] Update pt-br.json equivalent

## Phase 7: Implementation — Changes 8, 9, 10 (Search & Replace)
- [x] Replace all "5 free investigations" / "5 investigations" with "3 free investigations" / "3 investigations"
- [x] Replace all "8,620" / "8620" with "10,000+"
- [x] Replace any "$1.9 million" with "$9,000 per minute" + source attribution

## Phase 8: Validation
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues (18 pre-existing warnings)
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Verify no competitor names in any changed files

## Phase 9: Compound
- [x] Document learnings in task file
- [x] Update session-learnings.md

## Learnings

- **metric-card.tsx was made optional for `description`**: Added `source` and `sourceUrl` optional props. The `description` prop was made optional to support cards that only need a stat + label + source.
- **CountUp import removed**: The metrics section no longer uses animated counters — the new problem-focused stats are plain strings (e.g., "2–4 hours", "$9,000/min", "43%"). Removed the unused `CountUp` dynamic import.
- **Stale `.next/types` cache can break `check-types`**: Deleted `.next` directory when type check failed due to stale cached type files from a previous partial build.
- **New sections pattern**: New sections (WhyNowSection, CategoryIsRealSection) follow the `'use client'` pattern with `useTranslations` and are added as dynamic imports in `home-page.tsx`. Source attribution uses `text-xs text-muted-foreground/70` with `target="_blank" rel="noopener noreferrer"`.
- **Change 8 (5 free → 3 free)**: Already resolved in a previous session — engagement i18n already showed "3 free investigations" and plans.ts already had `credits: 3` for free tier. No code changes needed.
- **Change 10 ($1.9 million)**: Not found in source code — already removed in a previous session.
- **i18n keys for `whyDifferent` renamed**: The `minutesNotHours` card title was updated from "Engineering Time Is Too Valuable to Waste" to "Investigation in Minutes, Not Hours" with a `source` field for Change 7.

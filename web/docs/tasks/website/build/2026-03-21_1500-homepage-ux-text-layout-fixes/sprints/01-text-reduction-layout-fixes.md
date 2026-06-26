# Sprint 1: Text Reduction + Layout Fixes + Verification

**Objective:** Reduce all verbose homepage copy, fix metrics section layout, normalize section spacing, verify with Playwright screenshots.

---

## Files

- **files_to_modify:**
  - `apps/website/src/contexts/marketing/infrastructure/i18n/en.json`
  - `apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json`
  - `apps/website/src/contexts/marketing/presentation/pages/home-page.tsx`
  - `apps/website/src/contexts/marketing/presentation/components/sections/metric-card.tsx`

- **files_read_only:**
  - `packages/ui/src/presentation/layouts/section-layout.tsx`
  - `apps/website/src/contexts/marketing/presentation/components/sections/why-now-section.tsx`
  - `apps/website/src/contexts/marketing/presentation/components/sections/why-different.tsx`

---

## Tasks

### Task 1: Reduce EN i18n Text

Edit `apps/website/src/contexts/marketing/infrastructure/i18n/en.json`:

**Hero subheadline** → Reduce from 68 words to ~25-30:
```
"subheadline": "Most incident resolution time is spent investigating — checking logs, correlating data across 10+ tools. CauseFlow deploys six AI agents in parallel to find root cause in ~3 minutes. End-to-end resolution in ~30 minutes vs. 2-4 hours manually."
```

**How It Works steps** → Cut each to 1 sentence:
- receive: Cut "CauseFlow classifies severity as Critical and starts investigating immediately. No on-call engineer needed yet."
- investigate: Cut agent-by-agent listing, summarize
- identify: Cut "Confidence 91% — multiple signals..." detail
- recommend: Cut the exact change example, keep the concept
- learn: Cut explanation of Knowledge Base mechanics
- audit: Cut "The log is visible to you and cannot be altered." detail

**Why Now cards** → Lead with stat, cut prose:
- card1: Cut "But AI-written pull requests contain 1.7× more issues..." to essential stat
- card2: Cut the definition of operational toil paragraph. Keep the key stat.

**Why Different cards** → 1-2 sentences each:
- builtByEM: Cut the research explanation
- minutesNotHours: Cut the scenario walkthrough
- crossTool: Cut the customer report narrative
- gracefulDegradation: Cut the "each one you haven't connected" repetition
- builtForStartups: Cut the reputation lecture
- platformCompanies: Cut the examples (AWS/Google/Anthropic/OpenAI)

**Cross-Tool description** → Cut the scenario narrative

**Security on-demand reading** → Remove PET details (belongs on /security)

**CTA Final subtitle** → One sentence

**How It Works subtitle** → Remove timing repetition

### Task 2: Update PT-BR i18n Text

Mirror all EN changes in `apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json`.

### Task 3: Fix Metrics Section Layout

In `home-page.tsx`:
- Change metrics section title from `text-2xl font-bold sm:text-3xl lg:text-4xl` to `text-xl font-bold sm:text-2xl`
- Change section padding from `py-8 sm:py-10 lg:py-12` to `py-12 sm:py-16 lg:py-20`
- Fix cross-tool section: add bottom padding to match (change `pt-8 sm:pt-10 lg:pt-12` to full padding)

In `metric-card.tsx`:
- Change value from `text-4xl font-bold sm:text-5xl` to `text-3xl font-bold sm:text-4xl`
- Change label from `text-sm font-semibold uppercase tracking-wide` to `text-sm font-medium`
- Add `flex flex-col` for consistent vertical alignment

### Task 4: Playwright Screenshot Verification

Take screenshots at 3 viewports to verify:
- 375px (mobile)
- 768px (tablet)
- 1280px (desktop)

Verify: no text overflow, consistent card heights, uniform section spacing, readable text sizes.

---

## Acceptance Criteria

- [x] All homepage section texts reduced per word count targets
- [x] EN and PT-BR i18n files both updated with matching changes
- [x] Metrics section title visually subordinate to major section titles
- [x] Metrics card values don't wrap on tablet+ viewports
- [x] Metrics card heights consistent across all 3 cards
- [x] Section spacing follows documented rhythm
- [x] Cross-tool section has proper top AND bottom padding
- [ ] Playwright screenshots at 375px, 768px, 1280px saved to ./screenshots/ (BLOCKED: proot-distro ARM64)
- [x] `pnpm turbo build` passes
- [x] No text truncation or overflow on any viewport

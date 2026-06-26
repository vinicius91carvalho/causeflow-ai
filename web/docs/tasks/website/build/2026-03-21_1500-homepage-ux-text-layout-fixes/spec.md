# Homepage UX: Text Reduction & Layout Fixes

**Type:** Standard | **Area:** website | **Category:** build
**Created:** 2026-03-21 | **Status:** Ready

---

## Intent

Reduce verbose copy across all homepage sections to match B2B scanning patterns, fix the "Cost of Manual Investigation" metrics section layout (oversized titles, misaligned card content), and normalize section spacing for visual rhythm.

## Audience

B2B engineering leaders, SREs, and VPs of Engineering evaluating incident investigation tools. They scan pages in 5-10 seconds before deciding to read more. Every extra sentence is friction.

## Verification

Playwright screenshots at 3 viewports (mobile 375px, tablet 768px, desktop 1280px) confirming:
- Text fits without overflow on all breakpoints
- Metrics cards have consistent height and aligned content
- Sections have uniform vertical spacing rhythm
- Content hierarchy follows B2B scanning patterns (pain → solution → proof → CTA)

---

## Uncertainty Policy

- PT-BR translations may exceed EN word counts by ~20-30%. Allow PT-BR targets to be 25% above EN targets.
- If a translation cannot fit the target without losing meaning, prioritize clarity over word count.
- If layout wrapping occurs at a specific viewport despite text reduction, adjust Tailwind sizing rather than further cutting text.

---

## Changes

### 1. Text Reduction (EN + PT-BR i18n files)

**Files:** `apps/website/src/contexts/marketing/infrastructure/i18n/en.json`, `pt-br.json`

#### Hero Subheadline
- **Current:** 68 words — a wall of text explaining the entire product
- **Target:** ~25-30 words — one clear value proposition sentence
- **Approach:** Lead with the pain, state what CauseFlow does, give the key metric

#### How It Works Steps (6 steps)
- **Current:** ~220 words — each step is 2-3 sentences with excessive detail
- **Target:** ~90 words — each step is 1 crisp sentence
- **Approach:** Remove examples, specifics belong on /product page. The homepage tells the story, the product page tells the details.

#### Why Now Cards (2 cards)
- **Current:** ~180 words — long paragraphs with embedded data
- **Target:** ~80 words — lead with the stat, one supporting sentence
- **Approach:** Data point first, context second. Cut the "explanation of the explanation."

#### Why Different Cards (6 cards)
- **Current:** ~240 words — multi-sentence descriptions per card
- **Target:** ~120 words — 1-2 sentences per card max
- **Approach:** Each card should answer "so what?" in one sentence. Details belong on subpages.

#### Cross-Tool Section Description
- **Current:** ~100 words — narrative paragraph telling a story
- **Target:** ~50 words — concise differentiator statement
- **Approach:** Cut the scenario narrative. State the capability directly.

#### Security Commitment: On-demand Reading
- **Current:** 38 words with Privacy-Enhancing Technology explanation
- **Target:** ~15 words — the PET detail belongs on /security page

#### CTA Final Subtitle
- **Current:** 28 words — two sentences
- **Target:** ~15 words — one sentence

#### How It Works Subtitle
- **Current:** Repeats timing data already in metrics section
- **Target:** Cut to one focused line

### 2. Metrics Section Layout Fix

**Files:** `home-page.tsx`, `metric-card.tsx`

#### Problems Identified:
1. **Title too large:** `text-2xl sm:text-3xl lg:text-4xl` same as major sections, but this is a supporting data section
2. **Value text too large:** `text-4xl sm:text-5xl` — "2-4 hrs → ~30 min" wraps badly at this size
3. **Label text misaligned:** `uppercase tracking-wide text-sm font-semibold` with varying word counts causes uneven card heights
4. **Section padding inconsistent:** `py-8 sm:py-10 lg:py-12` vs SectionLayout default `py-16 sm:py-20 lg:py-24`

#### Exact Fixes:

**In `home-page.tsx` (line 329):**
- Metrics title: change `text-2xl font-bold sm:text-3xl lg:text-4xl` → `text-xl font-bold sm:text-2xl`
- Metrics section: change `py-8 sm:py-10 lg:py-12` → `py-12 sm:py-16 lg:py-20`
- Cross-tool section: change `pt-8 sm:pt-10 lg:pt-12` → remove the className override (use SectionLayout default padding)

**In `metric-card.tsx`:**
- Line 30: Change value from `text-4xl font-bold text-primary sm:text-5xl` → `text-3xl font-bold text-primary sm:text-4xl`
- Line 31: Change label from `text-sm font-semibold uppercase tracking-wide text-muted-foreground` → `text-sm font-medium text-muted-foreground`
- Line 29: Change `CardContent className="pt-6"` → `CardContent className="flex flex-col items-center justify-between pt-6 h-full"`
- Card wrapper: Add min-height via `min-h-[180px]` to the Card className

All 3 metric cards are affected (card1, card2, card3).

### 3. Section Spacing Normalization

**Current state (inconsistent):**
| Section | Padding |
|---------|---------|
| Trust Strip | `py-6 sm:py-8` |
| Metrics | `py-8 sm:py-10 lg:py-12` |
| How It Works | SectionLayout: `py-16 sm:py-20 lg:py-24` |
| Why Now | `py-16 sm:py-20 lg:py-24` |
| Why Different | `py-16 sm:py-20 lg:py-24` |
| Cross-Tool | `pt-8 sm:pt-10 lg:pt-12` |
| Usage Modes | SectionLayout: `py-16 sm:py-20 lg:py-24` |
| Security | SectionLayout: `py-16 sm:py-20 lg:py-24` |

**Target (consistent rhythm):**
- **Spacer sections** (trust strip, compliance): `py-6 sm:py-8` (keep as-is — intentionally compact)
- **Data/metrics sections**: `py-12 sm:py-16 lg:py-20` (lighter weight)
- **Content sections** (all major): `py-16 sm:py-20 lg:py-24` (keep SectionLayout default)
- **Dark/hero sections**: consistent with content sections

Fix the cross-tool section `pt-8 sm:pt-10 lg:pt-12` to use the full SectionLayout default (it only has `pt-*` padding, missing bottom padding).

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` | Text reduction across all homepage sections |
| `apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json` | Matching PT-BR text reductions |
| `apps/website/src/contexts/marketing/presentation/pages/home-page.tsx` | Metrics section title size, section padding fixes |
| `apps/website/src/contexts/marketing/presentation/components/sections/metric-card.tsx` | Value/label sizing, vertical alignment |

## Files Read-Only

| File | Reason |
|------|--------|
| `packages/ui/src/presentation/layouts/section-layout.tsx` | Reference for default spacing values |
| `apps/website/src/contexts/marketing/presentation/components/sections/why-now-section.tsx` | Reference for spacing (uses its own `py-*`) |
| `apps/website/src/contexts/marketing/presentation/components/sections/why-different.tsx` | Reference for spacing |

## Out of Scope

- Reordering homepage sections (current B2B order is sound: hero → trust → pain → solution → differentiators → CTA)
- Changing component architecture or adding new components
- Other pages (product, security, integrations, pricing)
- Animation changes
- Mobile menu or navigation changes

## Acceptance Criteria

- [x] All homepage section texts reduced per targets above
- [x] EN and PT-BR i18n files both updated
- [x] Metrics section title visually smaller than major section titles
- [x] Metrics card values don't wrap on tablet+ viewports
- [x] Metrics card heights consistent (cards visually aligned)
- [x] Section spacing follows the rhythm documented above
- [x] Cross-tool section has proper top AND bottom padding
- [ ] Playwright screenshots at 375px, 768px, 1280px show aligned layout (BLOCKED: proot-distro ARM64)
- [x] `pnpm turbo build` passes (no build errors)
- [x] No text truncation or overflow on any viewport

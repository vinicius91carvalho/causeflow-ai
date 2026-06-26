# Website UX Text & Layout Fixes

> **Status: DONE (closed 2026-04-28)** — Marked done by user. Likely a duplicate of the sibling `2026-03-21_1500-homepage-ux-text-layout-fixes` PRD which is already complete (1 sprint, status `complete`). No `progress.json` was ever created for this directory; no Build Candidate tag points here. Left in place for archival only — do NOT execute.

## What & Why

**Problem:** Website text is too long and verbose across all pages, especially the homepage. B2B buyers scan — they don't read paragraphs. The hero subheadline is ~80 words (should be ~25). The "Cost of Manual Investigation" section has oversized titles and misaligned text. The "Why Now?" and "Why CauseFlow Exists" cards have 50-80 word descriptions that lose readers. The /product page returns a 500 error (JSON parse failure). Content order doesn't prioritize what B2B buyers care about first.

**Desired Outcome:** Every text block is concise and scannable. Layout is clean and aligned. B2B value props lead each section. All pages load without errors. Before/after screenshots confirm improvements.

## Correctness Contract

**Audience:** B2B CTOs and Engineering Managers (2-50 engineers) evaluating incident investigation tools. They scan pages in under 60 seconds — every word must earn its place.
**Failure:** Text that reads like documentation instead of marketing copy. Layout misalignment that looks unprofessional.
**Danger:** Removing factual claims or data citations. Breaking existing working pages. Changing product positioning.

## Context Loaded

- `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` — All homepage, product, integrations, pricing text lives here as i18n keys
- `apps/website/src/contexts/marketing/presentation/pages/home-page.tsx` — Homepage layout with 12 sections
- `apps/website/src/contexts/marketing/presentation/components/sections/metric-card.tsx` — MetricCard uses `text-4xl sm:text-5xl` for values (too large)
- `apps/website/src/contexts/marketing/presentation/components/sections/why-now-section.tsx` — "Why Now?" section component
- Product page error: `SyntaxError: Unexpected end of JSON input` at `/en/product` — likely from recent uncommitted i18n changes

## Acceptance Criteria

- [ ] Hero subheadline is <= 25 words
- [ ] Every homepage card/step description is <= 40 words
- [ ] "Cost of Manual Investigation" metric values use `text-2xl sm:text-3xl` (not 4xl/5xl), labels are aligned
- [ ] "Why Now?" card body text is <= 40 words each
- [ ] "Why CauseFlow Exists" card descriptions are <= 40 words each
- [ ] "One Pipeline" description is <= 40 words
- [ ] Privacy-Preserving Mode description (homepage deployment section) is <= 40 words
- [ ] /product page loads without error (200 status)
- [ ] Security page paragraph texts are <= 50 words each
- [ ] All pages render correctly at 1440px desktop viewport
- [ ] PT-BR translations updated to match EN changes
- [ ] "Enterprise Security Without Enterprise Complexity" section has a distinct background (muted or dark variant)
- [ ] "Let's Talk About Your Incident Workflow" (CoFounderCTA) section removed from homepage
- [ ] "How CauseFlow investigates" uses less text — each step description <= 20 words
- [ ] No broken links or missing i18n keys

## Non-Goals / Boundaries

- Do NOT change product positioning, feature claims, or pricing
- Do NOT redesign page structure (exception: remove CoFounderCTA section per user request)
- Do NOT modify component architecture or add new components
- Do NOT touch dashboard app, shared packages, or deployment config
- Do NOT change SEO metadata (title, metaDescription) — these are optimized separately
- Do NOT remove source citations or data references — condense the surrounding text only

## If Uncertain

Flag and ask. When cutting text, prefer keeping: (1) concrete numbers, (2) differentiators from competitors, (3) data citations. Cut: explanations of obvious things, redundant phrases, filler words.

## Tradeoff Resolution

When conciseness conflicts with completeness: prefer conciseness because B2B buyers scan, not read. Keep the strongest claim per section.
When text brevity conflicts with SEO: prefer brevity — meta descriptions handle SEO separately.

## Verification

- [ ] `pnpm --filter website dev --hostname 127.0.0.1 --port 4000` — all pages load (200 status)
- [ ] Playwright screenshots at 1440px of all pages — visual alignment check
- [ ] `python3 -c "import json; json.load(open('apps/website/src/contexts/marketing/infrastructure/i18n/en.json'))"` — valid JSON
- [ ] `python3 -c "import json; json.load(open('apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json'))"` — valid JSON
- [ ] `pnpm exec biome check apps/website/src/` — no lint errors

## Issues Found (from screenshot analysis)

### Homepage (Critical — highest traffic page)

| Section | Issue | Current Words | Target |
|---|---|---|---|
| Hero subheadline | Way too long, reads like documentation | ~80 | <= 25 |
| Hero badge | Could be shorter | 12 | <= 10 |
| "Cost of Manual Investigation" | Values text-4xl/5xl too large; labels misaligned across cards; card1 source is a description, not a citation | Layout | Fix sizes + alignment |
| "How CauseFlow investigates" steps | Each description 40-60 words | 40-60 each | <= 30 each |
| "Why Now?" card 2 body | Extremely verbose | ~80 | <= 40 |
| "Why CauseFlow Exists" cards | All 6 cards have 40-80 word descriptions | 40-80 each | <= 40 each |
| "One Pipeline" description | Wall of text | ~80 | <= 35 |
| Privacy-Preserving description | Full paragraph in deployment section | ~70 | <= 40 |
| CTA final subtitle | Too long | ~30 | <= 20 |
| "Enterprise Security" section | Background should be different (currently same as surrounding) | Background | Change to muted/dark variant |
| "Let's Talk About Your Incident Workflow" (CoFounderCTA) | Remove entirely from homepage | Section | Remove |
| "How CauseFlow investigates" section | Too much text overall — reduce step count or merge steps | 6 steps | Fewer steps or shorter descriptions (<=20 words each) |

### Other Pages

| Page | Issue |
|---|---|
| /product | 500 error — `SyntaxError: Unexpected end of JSON input` |
| /security | "Privacy-Preserving Architecture" intro paragraph too long (~60 words) |
| /security | Card descriptions have redundant second line (technical detail repeating the description) |
| /integrations | "Technical + Business: The Bridge" principle description too long (~50 words) |

### Layout Fixes

| Component | File | Fix |
|---|---|---|
| MetricCard value size | `metric-card.tsx:30` | Change `text-4xl sm:text-5xl` to `text-2xl sm:text-3xl` |
| MetricCard label alignment | `metric-card.tsx:31` | Ensure consistent min-height or flex alignment across cards |
| Metrics section spacing | `home-page.tsx:326` | Review `py-8 sm:py-10 lg:py-12` — may need more breathing room |

## Implementation

### Step 1: Fix /product page error
- [ ] Investigate JSON parse error — likely truncated/malformed data in en.json product section or missing i18n key
- [ ] Verify fix with `curl http://127.0.0.1:4000/product`

### Step 2: Shorten homepage text (en.json)
- [ ] Hero subheadline: cut to ~25 words — lead with the value prop
- [ ] Hero badge: tighten to ~8 words
- [ ] "How CauseFlow investigates" step descriptions: cut each to ~20 words (less text overall)
- [ ] "Why Now?" card bodies: cut each to ~35 words, keep data citations
- [ ] "Why CauseFlow Exists" card descriptions: cut each to ~35 words
- [ ] "One Pipeline" description: cut to ~30 words
- [ ] Privacy-Preserving Mode description (deployment section): cut to ~35 words
- [ ] CTA final subtitle: cut to ~18 words
- [ ] "Cost of Manual Investigation" card1 source: change from description to brief citation format (e.g., "CauseFlow internal benchmarks" instead of a full sentence)

### Step 3: Homepage section changes
- [ ] Remove CoFounderCTA ("Let's Talk About Your Incident Workflow") from home-page.tsx
- [ ] Change "Enterprise Security Without Enterprise Complexity" section background to `variant="muted"` or `variant="dark"`

### Step 4: Fix "Cost of Manual Investigation" layout
- [ ] MetricCard: reduce value font size from text-4xl/5xl to text-2xl/3xl
- [ ] MetricCard: add consistent vertical alignment (min-h on label area or flex)
- [ ] Review section spacing for breathing room

### Step 5: Fix other pages text
- [ ] Security page: shorten "Privacy-Preserving Architecture" intro
- [ ] Security page: remove redundant second paragraphs from security detail cards
- [ ] Integrations page: shorten "Technical + Business: The Bridge" description

### Step 6: Update PT-BR translations
- [ ] Update pt-br.json to match all EN text changes (translate shortened versions)

### Step 7: Verify with screenshots
- [ ] Take full-page screenshots of all pages at 1440px
- [ ] Verify text alignment, spacing, and conciseness visually
- [ ] Confirm no broken layouts or missing content

## Learnings (filled after completion)

[To be filled]

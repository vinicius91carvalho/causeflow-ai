# UX Heuristic Review — CauseFlow AI Marketing Website
**Reviewer:** Senior UX Designer (heuristic audit)
**Date:** 2026-04-19
**Scope:** Light theme only — 8 routes × EN + PT-BR × 3 viewports (mobile-390 / tablet-768 / desktop-1440)
**Screenshots:** `screenshots/sprint-05/` (48 PNGs)
**Token reference:** Cleric theme light — `--background: 230 18% 95%`, `--card: 230 20% 97%`, `--border: 230 15% 87%`, `--accent: 172 66% 30%` (electric teal), `--primary: 232 50% 18%` (deep indigo), `--muted-foreground: 232 12% 44%`

---

## Executive Summary

- **The "too white" complaint is partially resolved but not eliminated.** The cleric theme correctly sets `--background` to a cool blue-grey (`hsl(230 18% 95%)`) rather than pure white, but long content pages (Privacy, Terms, Integrations catalog) render as unbroken pale-grey expanses with no mid-page surface variation, making extended reading feel washed-out and eyestrain-inducing.
- **The dark-band sections work well.** The stats block on Homepage (`hsl(232 30% 10%)` — `--menu-dark`) and the agent-trace / technical-architecture panels on Product create the strongest visual anchors on the entire site; these demonstrate exactly what the rest of the page lacks.
- **Card borders are too light to read at a glance.** `--border: 230 15% 87%` against `--card: 230 20% 97%` produces ~7% lightness contrast — cards on white-ish sections (Integrations grid, Pricing tier cards, Security commitment cards) effectively merge into the background on all viewports.
- **Typography rhythm is solid at desktop but breaks at mobile.** Heading size jumps between hero (~48 px) and section headers (~24 px) are abrupt on 390-px screens. The `--font-family-display` (Space Grotesk) renders well; the `--font-family-mono` (JetBrains Mono) used in the agent-trace section on Product is a standout moment.
- **CTA hierarchy is inconsistent across pages.** Homepage, Pricing, and Use Cases all have clear primary CTAs (teal-filled buttons). Security, Integrations, and Privacy trail off with faint "Get Early Access" sections that lack urgency and visual weight.

---

## Global "Too White" Verdict: **PARTIAL — Not Resolved**

### What improved
The base background is no longer pure `#ffffff` — the `230 18% 95%` cool-grey reads as a deliberate choice on high-quality displays. The hero dark overlay on Homepage, the dark CTA section on Product, and the stats belt on Homepage all break the monotony effectively.

### What remains broken
Seven of the eight routes have **three or more consecutive full-width sections rendered in the same 95–97% lightness range**, with no surface-level elevation change between them. The eye has nowhere to rest. The specific failure mode: `--background` at L95, `--card` at L97, and `--secondary`/`--muted` at L93 are so close in luminance that they read as a single flat field. Dividers are `--border` at L87 — visible up close but not sufficient to signal section transitions when scrolling.

### Color moves that would help (using existing tokens)
1. **Alternate section backgrounds** between `--background` (`hsl(230 18% 95%)`) and `--secondary` (`hsl(230 15% 93%)`) for adjacent sections — the 2% lightness difference is not enough. Instead, introduce one explicit section-tone: `hsl(230 25% 91%)` (a step below current `--border`) as a tinted band for every other feature section.
2. **Raise card elevation** by reducing `--card` lightness to ~99–100% (near-white card on grey background) OR by adding a visible `box-shadow` — the 2-point difference between `--card` L97 and `--background` L95 is imperceptible.
3. **Deploy `--accent` teal more aggressively as a section-entry tone.** A 6–8% teal-tinted background on 2–3 key sections (e.g., "Connects. Investigates. Explains." belt, the "Real scenarios" block, the integration security section) would punctuate the grey monotony without breaking brand.
4. **Use `--primary` indigo for section dividers**, not `--border`. A 1 px `hsl(232 50% 18% / 0.12)` hairline at full bleed reads as intentional rhythm rather than a default rule.
5. **The `--violet` chart-4 token (`hsl(280 65% 60%)`) is entirely unused on the marketing site** — deploying it as an accent for the "reasoning-in-action" animation section or the product phase indicators would add the chromatic variety the design urgently needs without adding new colours.

---

## Per-Route Findings

---

### / — Homepage

**Viewports reviewed:** desktop-1440, tablet-768, mobile-390

| # | Observation | Severity |
|---|---|---|
| 1 | **Hero section whitespace imbalance (desktop):** The mini-dashboard mockup sits well, but the left-side headline + CTA block has ~120 px of dead space below the CTA before the next section begins. At 1440 px, this reads as accidental padding rather than intentional breathing room. | P2 |
| 2 | **"Connects. Investigates. Explains." section is indistinguishable from adjacent sections.** No background change, no horizontal rule, no icon treatment that signals a new concept cluster. On the tablet viewport, three feature columns collapse to a single narrow column with nothing to separate them visually from the hero runoff. | P1 |
| 3 | **Stats dark band (the strongest element):** `2–4h → 30min` metric block in deep indigo reads perfectly. However, the transition out of it back to white-grey is abrupt — no gradient lip or tonal bridge. The eye snaps rather than flows. | P2 |
| 4 | **Mobile (390): CTA button is correctly sized (~44 px touch target) but the secondary "See how it works" link sits directly below with no spacing gap.** Two tap targets within 4–6 px vertical distance risk mis-taps and fail WCAG 2.5.8 (Target Size). | P1 |
| 5 | **Reasoning-in-action section (bottom):** "Watch the reasoning unfold" heading floats on a near-white surface with no animation preview visible in the screenshot (static state). Without the animation running, the section looks like placeholder content — empty box with a caption. Needs a static fallback visual or a thumbnail-with-play-state background. | P1 |

---

### /product — How It Works

**Viewports reviewed:** desktop-1440, tablet-768, mobile-390

| # | Observation | Severity |
|---|---|---|
| 1 | **Phase labels ("Phase 1 — Assisted Investigation", etc.) use muted foreground text** (`--muted-foreground: 232 12% 44%`) at roughly 13–14 px. The contrast ratio against `--background` (L95) is approximately 3.8:1 — below the WCAG 2.1 AA threshold of 4.5:1 for normal text. | P0 |
| 2 | **Agent-trace dark panel (the standout element):** The monospaced trace log on dark background (`--menu-dark`) is the most distinctive, branded moment on the entire website. The teal-highlighted lines use `--accent` effectively. This pattern should be referenced as the template for other "proof" sections across the site. | — (positive) |
| 3 | **Technical Architecture coloured boxes (teal/purple/yellow/green on dark)** read well at desktop but at mobile-390 the box labels truncate without wrapping, cutting off integration names at ~50% of the text. | P1 |
| 4 | **"How CauseFlow Connects to Your Systems" integration grid (bottom of product page):** white-card tiles on white-grey background — same card elevation problem as Homepage. At tablet, cards lose their implied boundary entirely. | P1 |
| 5 | **"Ready to stop hunting logs?" CTA section** at page end: pale teal-tinted background is the right move — best implementation of a tonal break on this page. CTA button contrast passes. However, the section heading weight (~600) reads as body text weight at mobile sizes — needs to step up to 700–800. | P2 |

---

### /security — Security

**Viewports reviewed:** desktop-1440, tablet-768, mobile-390

| # | Observation | Severity |
|---|---|---|
| 1 | **Hero dark panel works**, but the page abruptly exits into a flat grey content area. "Privacy-Preserving Architecture" through "Compliance and Certifications" — four consecutive sections of equal visual weight, same background, same card style. No section rhythm. At desktop the compliance table is readable; at mobile it becomes a dense flat list with no scannable structure. | P1 |
| 2 | **Security Architecture coloured layer boxes (deep in page):** same pattern as Product page dark panel. Effective on desktop. At mobile-390, the layered boxes stack correctly but the icon background circles (teal, purple, yellow, green) are the only colour on the entire lower half of the page — they carry the entire visual load and start to feel decorative rather than informational. | P2 |
| 3 | **"Data Isolation (Multi-tenancy)" section:** plain white table-like layout on grey background. No table borders, no zebra striping, no row highlight — at mobile this is an unstructured list of text pairs with no hierarchy. | P1 |
| 4 | **"Why AWS Bedrock" cards** use the same flat card treatment. Icon contrast (teal-on-white-card) passes, but card-to-background boundary fails the same lightness-delta problem. | P1 |
| 5 | **Mobile (390) "Security First. Always." headline:** The gradient or highlighted word treatment visible at desktop (`First.` in teal/accent) is absent at mobile — headline renders as plain text, losing the typographic signature. Verify the CSS gradient text is not clipped by `overflow: hidden` on the mobile container. | P0 |

---

### /integrations — Integrations

**Viewports reviewed:** desktop-1440, tablet-768, mobile-390

| # | Observation | Severity |
|---|---|---|
| 1 | **The integration catalog is the most "too white" page on the site.** 30+ cards rendered in 3-column (desktop) → 2-column (tablet) → 1-column (mobile) grids, all on the same `--background` field, all with `--card` surfaces that are 2 L-points lighter. The page is a wall of near-identical pale rectangles — no colour category coding, no iconographic colour, no alternating row. | P1 |
| 2 | **Category filter tabs (Monitoring, Alerting, etc.) have no active-state colour** visible in the screenshots — or if they do, it is not legible at the zoom level. At mobile, the tab row appears to overflow horizontally without scroll affordance (no fade-out gradient at edge). | P1 |
| 3 | **Integration logos/icons are monochrome or absent.** Real integration icons (PagerDuty, Slack, GitHub, etc.) carry strong brand colours that would naturally break the grey monotony. If current icons are placeholder SVGs, replacing them with official coloured logos would be the highest-ROI fix on this page. | P1 |
| 4 | **"Integration Security" section at page bottom** (3-column feature grid on grey-tinted band): correct use of background tone, but the tint is so subtle that at mobile it is indistinguishable from the catalog above it. Needs a stronger background step — suggest `hsl(230 25% 91%)` or a full `--primary` indigo strip. | P2 |
| 5 | **"Get Early Access" CTA section:** On all viewports this renders as a centre-aligned block with a teal button, floating in whitespace with no containing surface. It looks unfinished — needs a full-bleed background (dark indigo or teal-tinted) to signal page termination. | P2 |

---

### /pricing — Pricing

**Viewports reviewed:** desktop-1440, tablet-768, mobile-390

| # | Observation | Severity |
|---|---|---|
| 1 | **Pricing page is the best-designed page on the site** in terms of visual hierarchy. The hero dark band, the 4-column plan grid with a teal "Pro (Most Popular)" highlight card, the ROI calculator block, and the comparison table all use distinct visual treatments. This is the target standard. | — (positive) |
| 2 | **"Pro" card teal highlight** (`--accent` background with `--accent-foreground` text) passes contrast at desktop and tablet. At mobile-390, the card stacks to full width and the "Most Popular" badge positioning overlaps the card title — badge likely needs `z-index` or margin-top adjustment. | P1 |
| 3 | **ROI Calculator section:** the slider inputs and result display use very light placeholder text. "How many engineers" input label and the result figures (`$349/mo`, `$0 estimated annual savings`) render in `--muted-foreground` — at mobile these approach 3:1 contrast against the white calculator card surface. | P1 |
| 4 | **Comparison table ("Why pay per user"):** desktop reads well as a data table with clear column headers. At tablet, columns compress to the point where enterprise-column content truncates. At mobile, the table becomes a flat text block — no sticky header, no horizontal scroll affordance. | P1 |
| 5 | **FAQ section** uses a clean accordion pattern but carries no surface differentiation — on a page that otherwise uses colour well, the FAQ feels appended. A subtle `--secondary` tint on the FAQ background would close out the page consistently. | P2 |

---

### /use-cases — Use Cases

**Viewports reviewed:** desktop-1440, tablet-768, mobile-390

| # | Observation | Severity |
|---|---|---|
| 1 | **Three-panel case study layout is the clearest UX on the site.** Symptom / How CauseFlow Investigated / Resolution in three-column horizontal layout with coloured left-border icons works at desktop and tablet. This pattern is a strong template for the homepage feature sections. | — (positive) |
| 2 | **Section dividers between case studies are 1 px `--border` lines** that become invisible when scrolling quickly on mobile. Each case study section needs more spatial separation — at minimum 64 px padding + a subtle background alternation. | P2 |
| 3 | **"Symptom" / "How CauseFlow Investigated" / "Resolution" column headers** use `--muted-foreground` at ~13 px. Same contrast failure as noted on Product — approximately 3.8:1, below 4.5:1 AA threshold. | P0 |
| 4 | **Mobile (390): three columns collapse to single column**, which is correct, but the case study tag ("SaaS / Marketing", "SaaS / Sales") floats at top with no visual grouping with the case study it labels. Needs tighter spatial binding to its parent card. | P2 |
| 5 | **"Ready to Investigate Your Next Incident in Minutes?" CTA** has the same floating-in-whitespace problem as Integrations. Needs a containing surface. | P2 |

---

### /privacy — Privacy Policy

**Viewports reviewed:** desktop-1440, tablet-768, mobile-390

| # | Observation | Severity |
|---|---|---|
| 1 | **Legal pages are the worst-offending "too white" case.** A single column of body text in `--foreground` on `--background` with no structural breaks, no sidebar TOC, no section chips, no background alternation. At desktop, a 1000+ px wide column of text reads like a raw HTML dump. Maximum readable line length is 70–80 characters; current layout exceeds that on desktop. | P1 |
| 2 | **No visual hierarchy between H2 section heads and H3 subsections** — both render in similar weight/size from a distance; only spacing separates them. At mobile, heading runoff is common. | P1 |
| 3 | **Section heading "Data Collected", "How We Use Data"** etc. have no distinguishing treatment (no icon, no left-bar accent, no pill badge). On a long legal document this is a scanning problem — users cannot locate specific sections quickly. | P2 |
| 4 | **Line height is comfortable** at body copy size — no cramping observed. However, the paragraph-to-paragraph spacing appears identical to heading-to-paragraph spacing, reducing visual structure. | P2 |
| 5 | **"CauseFlow AI" brand footer reads well at all viewports** — the footer's dark indigo background creates the only meaningful tonal anchor on the entire Privacy page. | — (positive) |

---

### /terms — Terms of Service

**Viewports reviewed:** desktop-1440, tablet-768, mobile-390

| # | Observation | Severity |
|---|---|---|
| 1 | **Same structural problems as Privacy** — monotone single-column layout, same absence of visual hierarchy markers. At mobile-390 the text is acceptably sized but the absence of any navigational structure (no sticky TOC, no anchor links) makes the page feel endless. | P1 |
| 2 | **Terms runs significantly longer than Privacy** in the screenshots — more sections, denser paragraphs. The flat layout compounds the reading difficulty proportionally. At desktop, a two-column layout (TOC sidebar + content) would resolve this. | P1 |
| 3 | **Section headers ("Service Definition and Limitations", "Plans, Pricing and Billing") use `--foreground` weight at what appears to be 600 / 1.1rem** — barely distinguished from the body paragraphs below them at mobile. | P2 |
| 4 | **No horizontal rules or visual separators between top-level sections** — the Terms document is one undifferentiated scroll. Even a `--border` hairline between sections would help. | P2 |
| 5 | **Positive:** The footer dark-indigo anchor is consistent. The minimal header (logo only) is correct for a legal page — no distraction. | — (positive) |

---

## Prioritized Fix List

| Priority | Fix | Pages Affected | Token / Implementation | Expected Impact |
|---|---|---|---|---|
| **1 — P0** | Increase phase/column label contrast: change `--muted-foreground` usage on small descriptive labels to `--foreground` or a new mid-tone `hsl(232 30% 30%)`. Must reach 4.5:1 against card/bg surface. | /product, /use-cases | Replace `text-muted-foreground` with `text-foreground/80` on sub-labels < 16 px | WCAG AA compliance, legal risk eliminated |
| **2 — P0** | Fix mobile gradient-text clipping on Security hero headline. Audit `overflow: hidden` on parent containers for the teal-gradient word treatment. | /security (mobile) | CSS audit: remove `overflow-hidden` or add `pb-1` to gradient text container | Brand signature visible on all viewports |
| **3 — P1** | Add alternating section backgrounds across all content pages. Odd sections: `--background` (`hsl(230 18% 95%)`). Even sections: `hsl(230 22% 92%)` (new mid-tone step). Avoids adding new tokens — use inline `style` or a `section-alt` Tailwind utility. | All 8 routes | New Tailwind utility `.bg-section-alt { background: hsl(230 22% 92%); }` in base.css | Eliminates the flat-grey-wall problem across the site in one pass |
| **4 — P1** | Raise card elevation: set `--card` to `0 0% 100%` (pure white) so cards lift off the grey background visibly, OR add `shadow-sm` (`0 1px 2px hsl(232 50% 18% / 0.08)`) to all card components. | Homepage, /integrations, /security, /product | `--card: 0 0% 100%` in cleric light.css OR `shadow-sm` on `<Card>` in ui package | Card boundaries immediately legible — single-token change, global effect |
| **5 — P1** | Deploy `--chart-4` violet (`hsl(280 65% 60%)`) as the accent colour for the reasoning-in-action / "Watch the reasoning unfold" section. Give it a dark indigo (`--primary`) background panel matching the stats belt. | Homepage (bottom) | Wrap section in `bg-primary` dark panel; use `text-chart-4` for animation highlights | Closes the visual hierarchy gap at page end; makes the section feel finished |
| **6 — P1** | Fix mobile comparison table on /pricing: replace horizontal `<table>` with a card-per-plan stacked layout below `sm:` breakpoint, showing CauseFlow AI column only with competitor columns collapsible. | /pricing (mobile) | New responsive layout component for the comparison table | Eliminates truncation, improves scannability on 390-px screens |
| **7 — P2** | Add integration icon colours to the catalog. Source official SVG/PNG logos for the top 12 integrations (Slack, PagerDuty, Datadog, GitHub, Jira, etc.) with their brand colours. Placeholder monochrome icons are the primary cause of the grey-wall feeling on /integrations. | /integrations | Swap SVG assets in the integration data file | Highest colour-injection ROI on the site — no CSS changes needed |
| **8 — P2** | Legal page typography structure: add a sticky in-page TOC (sidebar at `lg:`, top-drawer at `sm:`) to Privacy and Terms, cap content column at `max-w-prose` (65 ch) at all viewports, and add a `border-l-2 border-accent` left-accent to H2 section headings. | /privacy, /terms | New `LegalPageLayout` wrapper component with TOC + prose width constraint | Transforms wall-of-text into navigable document; reduces perceived whiteness by introducing structural rhythm |

---

*Review conducted via static screenshot analysis (48 PNGs). No server started, no code modified. All token references from `packages/ui/src/themes/cleric/tokens/light.css` and `packages/ui/src/themes/shared/base.css`.*

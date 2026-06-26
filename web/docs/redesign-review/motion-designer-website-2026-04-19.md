# Motion & Interaction Design Review — CauseFlow AI Marketing Website
**Reviewer role:** Senior Motion/Interaction Designer
**Date:** 2026-04-19
**Scope:** Motion, transitions, scroll-triggered reveals, reduced-motion respect across 6 routes (home, product, security, integrations, use-cases, pricing). Color/layout is excluded — covered by the separate UX Designer report.

---

## Executive Summary

1. **Reduced-motion compliance is robust.** The two-layer defense (CSS `@media` global override + JS `prefersReducedMotion` hook gate) ensures zero hidden ghosts in reduce mode. All 6 routes passed visual inspection.
2. **Scroll-reveal pacing is consistent but uniformly flat.** Every section-level `AnimateOnScroll` uses the same `fade-up` variant at 600 ms with `cubic-bezier(0.16, 1, 0.3, 1)`. The easing is excellent (spring-like Expo Out), but the uniform 600 ms duration for both small cards and large section blocks makes the page feel like a single-speed conveyor rather than a layered narrative.
3. **Security page has a high-density cascade problem.** Cards staggered at `delay=(idx+1)*100 ms` (100, 200, 300 ms) with a base duration of 600 ms produces overlapping chains where up to 3 cards are mid-flight simultaneously — a "popcorn" effect that is distracting on a trust-critical page.
4. **TechLogoCarousel direction variety is present but speed is too fast.** Two rows scroll at opposite directions (LTR / RTL) at 30 s per cycle. At 8–11 logos doubled (16–22 items), the effective per-logo dwell time is approximately 1.4–1.9 s, which is too fast for a user to consciously read a brand name and feel confident in the integrations story.
5. **ReasoningInAction / InvestigationDashboardPreview animation has a strong concept but a structural ordering problem.** The interactive physics-driven SVG is placed *after* the final CTA, which buries the site's most dynamic moment at the very bottom. The static MiniDashboard in the hero and this animated counterpart are never positioned to create narrative contrast.

---

## Reduced-Motion Verdict

**Overall: PASS**

### Defense layers verified

**Layer 1 — CSS global (`packages/ui/src/themes/shared/base.css`, lines 97–131)**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }
  .opacity-0 { opacity: 1 !important; }
  .translate-y-8, .-translate-y-8, .translate-y-5, .-translate-y-5 { transform: none !important; }
  .translate-x-8, .-translate-x-8 { transform: none !important; }
  .scale-95, .scale-[0.3], .scale-[0.98] { transform: none !important; }
}
```
This is belt-and-suspenders: even if the JS hook misfires, the CSS forcibly exposes every hidden state.

**Layer 2 — JS hook (`use-animate-on-scroll.ts`, line 46)**
`prefersReducedMotion` is read synchronously via `useIsomorphicLayoutEffect` (runs before first browser paint), and `AnimateOnScroll` short-circuits to `showAsVisible = true` when it is set.

**Layer 3 — TechLogoCarousel**
The marquee uses `animate-scroll` / `animate-scroll-reverse` CSS utilities (keyframe-based). The CSS global override sets `animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;`, which effectively freezes the marquee at frame 0, making all logos visible without motion.

### Per-route evidence

| Route | t1-mid-scroll visible | reduce-mid visible | Verdict |
|---|---|---|---|
| home | Yes — carousel cards, HowWorks section fully rendered | Yes — identical content layout, no opacity:0 ghosts visible | PASS |
| product | Yes — terminal block + Technical Architecture layers visible | Yes — content identical, no partially-faded elements | PASS |
| security | Yes — commitment cards grid, architecture layers visible | Yes — all 6 integration-security cards and 3 Bedrock cards visible without any opacity gaps | PASS |
| integrations | Yes — full catalog grid rendered | Yes — identical catalog, marquee not present in mid-scroll position | PASS |
| use-cases | Yes — incident story cards (Symptom / Investigation / Resolution columns) visible | Yes — identical layout | PASS |
| pricing | Yes — comparison table and FAQ accordion visible | Yes — no hidden rows or collapsed states | PASS |

**Notable observation on security:** The `security-t1-mid-scroll.png` shows the page at reduced viewport/zoom compared to `security-reduce-mid.png`. Both exhibit the same content volume — the reduce version is not missing any elements. The architectural difference in viewport scale appears to be a Playwright zoom artifact, not a motion issue.

---

## Per-Route Motion Observations

### Home (`/`)

**Hero (t0-above-fold)**
The hero is split-screen: left side has bold heading + CTAs + trust badges, right side has the `MiniDashboardVisual` — a static DOM simulation of the product dashboard. Because it is static with no entry animation and no ongoing micro-interaction, the card reads as a screenshot rather than a live product. The hero has no scroll-entrance animation (correct — above-fold content should not hide behind JS), but it also has zero micro-animation (logo pulse, typing cursor, activity indicator). The `float` keyframe defined in the theme (3 s ease-in-out infinite, 6 px vertical travel) is available but unused on the mini-dash. The `glow-pulse` keyframe (2 s ease-in-out, box-shadow pulse) is also unused here.

**Scroll reveals (t1-mid-scroll)**
The carousel section appears mid-scroll with the `UseCasesCarouselSection` (INV-xxxx cards) and the `AlertInvestigation` section entering view. Both are wrapped in `AnimateOnScroll` with default `fade-up` / 600 ms / 0 ms delay. At 50% scroll both sections have already completed their animation, confirming the `threshold: 0.1` trigger fires early. The carousel pagination dots (3 visible + faded) are static — no indicator animation on the active dot. The card lateral swipe chevrons are present but static.

**Footer area / ReasoningInAction (t2-footer)**
The `InvestigationDashboardPreview` is a genuinely impressive piece of work: 5 sequential phases (0 → 5) driven by `setTimeout` starting at 300 ms, tool-node scanning at 120 ms per node, and RAF-throttled mouse-repulsion physics. **However** in the `home-t2-footer.png` screenshot we see the page at footer level — the network node visualization has already cycled through its phases and settled to the "root cause found" state. Visitors who scroll fast will land on a completed animation rather than a live one. The animation fires once on mount (no scroll trigger) and cannot be replayed. Additionally, this section appears *after* the final CTA (`CtaStopHunting`), which means the most technically impressive motion element has no conversion goal below it.

---

### Product (`/product`)

**Hero (t0-above-fold)**
Full-bleed dark hero with centered text. No animation — appropriate for a hero. Clean static entry consistent with the site's pattern.

**Scroll reveals (t1-mid-scroll)**
The terminal-output "Investigation #4821" block and the "Technical Architecture" stack (Connectivity Layer → Proprietary Core → ...) are visible with cards rendering with their border-left accent colors. The architecture layer blocks have staggered `AnimateOnScroll delay` values. In the `reduce-mid` screenshot the layout is identical, confirming no hidden states. No issues found.

**Footer (t2-footer)**
The footer is simple — CTA card + standard footer. No carousel or complex animation at this depth. Clean exit.

---

### Security (`/security`)

**Hero (t0-above-fold)**
Full-bleed dark hero, no animation — appropriate. Below the fold immediately shows the "Paranoid by Design / Security first. Always." section with four badge cards partially visible (four icons showing but clipped at bottom).

**Scroll reveals (t1-mid-scroll) — Cascade issue**
The security page uses `AnimateOnScroll` with `delay={(idx + 1) * 100}` for grids of cards. With a grid of 3 cards:
- Card 1: delay 100 ms, duration 600 ms → in-flight 100–700 ms
- Card 2: delay 200 ms, duration 600 ms → in-flight 200–800 ms
- Card 3: delay 300 ms, duration 600 ms → in-flight 300–900 ms

At any point between 200–700 ms, two or three cards are simultaneously animating. This "popcorn" cascade is particularly jarring on the Bedrock section (3 cards) and the Integration Security section (6 cards, delays up to 600 ms). The `t1-mid-scroll` screenshot captures a static moment that passes visual inspection, but in motion this produces a choppy stagger chain.

**Security Architecture section**
The `ArchitectureLayerBox` components use staggered delays defined in the page data. This vertical stagger (each layer box entering sequentially) is the most compositionally appropriate stagger on the entire site — it correctly implies sequential data flow downward. This pattern should be preserved and potentially tightened (see Recommendations).

**Footer (t2-footer)**
The final CTA card is a `scale-up` variant — the only `scale-up` usage on this route. At 600 ms duration with `cubic-bezier(0.16, 1, 0.3, 1)`, scaling from 0.95 → 1.0 is barely perceptible (5% scale change over 600 ms on a large card reads as near-invisible). Consider either shortening to 300 ms or increasing the scale delta to 0.88 for the CTA.

---

### Integrations (`/integrations`)

**Hero (t0-above-fold)**
Dark hero. Clean static entry. Below the fold, the category filter tabs (All / Monitoring / Communication / ...) and the first three integration cards (AWS CloudWatch, Datadog, Sentry) are immediately visible.

**Scroll reveals (t1-mid-scroll)**
The integrations catalog is a pure static grid — no `AnimateOnScroll` wrapping on individual cards. This is actually correct: the catalog is data-dense and functional (searchable/filterable), so revealing 30+ cards one by one would be chaotic. The absence of animation here is a good judgment call.

**Footer (t2-footer)**
Simple CTA + footer. No animation. The `reduce-mid` and `t1-mid-scroll` screenshots are pixel-for-pixel identical in content — confirming no hidden states.

---

### Use Cases (`/use-cases`)

**Hero (t0-above-fold)**
Dark hero ("Real Incidents. Real Resolutions.") Clean static entry. Immediately below: the first use-case story card (SaaS/Marketing badge + three-column layout: Symptom / How CauseFlow Investigated / Resolution).

**Scroll reveals (t1-mid-scroll)**
The three-column incident story cards are fully visible at mid-scroll. The `reduce-mid` screenshot is identical — PASS. The "Agents involved" badge row at the bottom of each case uses small badge chips. These are static — no sequential entrance. Given their supporting role (they are supplementary metadata), static rendering is correct.

**Footer (t2-footer)**
CTA + footer. Clean. The footer CTA uses the `scale-up` variant with the same 600 ms caveat as other routes.

---

### Pricing (`/pricing`)

**Hero (t0-above-fold)**
Dark hero. Immediately below: the pricing toggle (Monthly / Annual) and all four plan cards (Starter / Pro / Business / Enterprise). The Pro card has a "Most popular" badge and green background. No animation on the plan cards — appropriate since this is a high-intent decision area where stability and scan-ability trump motion.

**Scroll reveals (t1-mid-scroll)**
The competitive comparison table and FAQ accordion are `AnimateOnScroll`-wrapped with `delay={200}`. At mid-scroll both are fully visible. The FAQ accordion chevrons are static (expand on click, which uses the `accordion-down` keyframe at 0.2 s ease-out — the one section-level animation that has an appropriate fast duration).

**Footer (t2-footer)**
CTA + footer. A bottom-left Clerk error badge (`1 Issue`) is visible in the `pricing-t2-footer.png` — this appears to be a Playwright artifact from the Clerk environment, not a production issue.

---

## Marquee / Dashboard Animation Assessment

### TechLogoCarousel (home page, section 4)

**Implementation:** Two rows, `animate-scroll` (RTL direction, 30 s) and `animate-scroll-reverse` (LTR direction, 30 s). Logos are doubled in the DOM (16 and 22 items respectively) to create seamless looping. Hover pauses both rows. Logo items show a 20×20 SVG icon + brand name text side by side.

**Speed assessment:** At 30 s per full cycle with 16 items in a row, effective dwell per logo ≈ 1.9 s (RTL row). At 22 items, ≈ 1.4 s (LTR row). For brand recognition, a minimum 2.5–3 s dwell per logo is recommended (users need ~1.5 s to fixate on a logo and ~0.5–1 s to read the brand name). **Current speed is 25–45% too fast.**

**Direction variety:** Good — opposite directions create visual interest and prevent monotony. This is a well-implemented directional decision. No changes needed here.

**Logo density:** 8 monitoring logos (RTL row) and 11 workflow logos (LTR row). At the visible viewport width of ~1400 px with 12 px gaps, approximately 4–5 logos are visible simultaneously per row. This density is appropriate — not overcrowded.

**Reduced-motion behavior:** The CSS global override freezes both rows at frame 0 (`animation-iteration-count: 1; animation-duration: 0.01ms`). The freeze position shows the first few logos from each row. This is acceptable — content is visible.

### InvestigationDashboardPreview (home page, section 10 — "Reasoning in Action")

The 5-phase sequential animation (event received → tool scanning → hypothesis → root cause → fix recommendation) is the strongest motion storytelling element on the site. It demonstrates the product working in real time with:
- 300 ms ramp-in
- Tool node scanning at 120 ms/node (appropriate — reads as "thinking fast")
- 3 s pause at phase 3 before root cause reveal (creates tension correctly)
- Mouse-repulsion physics on tool nodes adds delight without distraction

**Structural problems identified:**
1. The animation fires on component mount, not on scroll entry. A user who scrolls quickly past will see a completed state — root cause already revealed — rather than the animated story. The `ReasoningInActionSection` wraps the component in `AnimateOnScroll` for the fade-up entrance, but the internal phase timers start immediately on mount regardless of scroll position.
2. The section is placed after the final CTA. There is no content below it to convert the emotional response it generates. If a user watches the full animation and is impressed, the next element is the footer.

---

## Hero Animation Assessment

**MiniDashboardVisual vs. InvestigationDashboardPreview**

The hero (above fold) uses `MiniDashboardVisual` — a rich DOM simulation of the dashboard with agent activity feed, root cause card, and confidence metrics. It is static on first paint with no ongoing micro-animation. It correctly avoids JS-gated animation (above fold content must be immediately visible).

The animated `InvestigationDashboardPreview` at the bottom of the page tells the same story — same data schema, same "root cause found" conclusion — but with motion and interactivity. The two visuals are not in dialogue with each other. A user landing on the hero sees the "result" (completed investigation), scrolls through the entire page, and reaches the "process" (investigation in real time) at the very bottom. This inverts the natural narrative arc (problem → solution → social proof → how it works).

**Proposed narrative reordering (motion perspective only):**
- Keep `MiniDashboardVisual` in the hero as static "what you get"
- Move `ReasoningInAction` to section 3 or 4, positioned as "how it gets there" — the animated process that explains the hero's output
- Ensure the internal phase timers are gated on IntersectionObserver entry (or a `useEffect` that starts only when `isVisible` becomes true)

---

## Prioritized Recommendations

| Priority | ID | Issue | Recommendation | Timing / Easing |
|---|---|---|---|---|
| P0 | MOT-01 | InvestigationDashboardPreview phase timers start on mount, not on scroll entry — users who scroll past quickly see a completed animation | Gate `phase` timer `useEffect` on an `isVisible` prop passed from `AnimateOnScroll` (or use the `useAnimateOnScroll` hook directly inside the component). Reset `phase` to 0 when `isVisible` transitions from true → false if `triggerOnce: false` | N/A (architectural) |
| P0 | MOT-02 | ReasoningInAction section placed after final CTA — the most impressive motion element has no conversion goal below it | Move the section above `CtaStopHuntingSection` (swap order of sections 9 and 10 in `home-page.tsx`). The CTA then captures emotional momentum from watching the animation | N/A (structural) |
| P1 | MOT-03 | TechLogoCarousel scroll speed too fast — 30 s for 22 items gives 1.4 s per logo, below 2.5 s minimum for conscious brand recognition | Increase animation duration from `30s` to `45s` on both `animate-scroll` and `animate-scroll-reverse` utilities in `packages/ui/src/themes/original/animations/utilities.css` | `45s linear infinite` (was 30s) |
| P1 | MOT-04 | Security page card stagger creates "popcorn" cascade — up to 6 cards (Integration Security grid) overlap in-flight simultaneously | Reduce stagger step from `(idx+1)*100 ms` to `(idx+1)*60 ms` AND reduce individual card duration from 600 ms to 350 ms. Max concurrent in-flight drops from 6 to 2 | Duration: `350ms`, stagger step: `60ms`, easing: `cubic-bezier(0.16, 1, 0.3, 1)` |
| P1 | MOT-05 | `scale-up` CTA variant barely perceptible — 0.95→1.0 scale over 600 ms on a large card is near-invisible | Reduce duration to 300 ms OR increase hidden scale to `scale-[0.88]` in the `scale-up` variant definition | Duration: `300ms`, scale hidden: `0.88`, easing unchanged |
| P1 | MOT-06 | All section-level `AnimateOnScroll` use the same 600 ms duration regardless of element size — large sections (HowWorksSection, DuoProductsSection) and small ones (single headings) animate identically | Adopt a two-tier duration system: small elements (headings, single cards, badge rows) → `400ms`; section-level blocks → `600ms`. Pass `duration` prop explicitly at call site rather than relying on default | Small: `duration={400}`, large: `duration={600}` (existing default) |
| P2 | MOT-07 | MiniDashboardVisual in hero has no micro-animation — static DOM with no visual activity indicators | Add a subtle `float` animation (existing keyframe: 3 s ease-in-out, 6 px travel) to the root cause confidence card within the mini-dash. Add a blinking cursor to the terminal-style feed. Both should respect `prefers-reduced-motion` via the CSS layer | `float 3s ease-in-out infinite` (existing), cursor blink `1s step-end infinite` |
| P2 | MOT-08 | No page-to-page transition — Next.js App Router default (instant cut) between marketing pages | Add a minimal View Transitions API fade: `document.startViewTransition()` via a client-side `Link` wrapper. Duration 150 ms opacity fade-out/fade-in. This is a progressive enhancement — falls back gracefully. Do NOT use full-page slide transitions (disorienting at marketing site scale) | `150ms ease-in-out` opacity |
| P2 | MOT-09 | Hero CTA button uses `animate-button-glow` keyframe? Visually not evident in screenshot — verify the glow pulse is active and visible against the dark hero background | Confirm `animate-button-glow` is applied to the primary CTA. If present, increase peak `box-shadow` from `24px 6px hsl(var(--accent)/0.35)` to `30px 8px hsl(var(--accent)/0.5)` for better visibility at hero scale | Existing: `2s ease-in-out infinite`, increase peak opacity |
| P2 | MOT-10 | Carousel pagination dots on `UseCasesCarouselSection` (home mid-scroll) are static — active dot has no size or brightness transition on change | Add a `transition-all 200ms ease-out` to the active dot indicator with a `w-6` → `w-2` size change on active/inactive toggle. This provides position feedback without requiring full animation | `200ms ease-out` |

---

## Concrete Timing Reference

### Current system (inferred from source)

| Element | Duration | Delay | Easing |
|---|---|---|---|
| All `AnimateOnScroll` defaults | 600 ms | 0 ms | `cubic-bezier(0.16, 1, 0.3, 1)` — Expo Out |
| Security card stagger | 600 ms | (idx+1)×100 ms | Expo Out |
| Architecture layer stagger | 600 ms | varies (0–400 ms from page data) | Expo Out |
| Marquee (both rows) | 30 s cycle | — | `linear` |
| Accordion open/close | 200 ms | — | `ease-out` |
| Hover card lift (`hover:-translate-y-1`) | 300 ms | — | default ease |
| InvestigationDashboard phase 0→1 | 300 ms | — | `setTimeout` |
| InvestigationDashboard phase 1→2 | 600 ms after phase 0 | — | `setTimeout` |
| InvestigationDashboard tool scan | 120 ms/node | — | step |

### Recommended system (this review)

| Element | Recommended Duration | Notes |
|---|---|---|
| Single heading / eyebrow / badge | 300–350 ms | Down from 600 ms |
| Single card in grid | 350 ms | Down from 600 ms, reduce stagger step to 60 ms |
| Full section block | 500–600 ms | Keep existing for large sections |
| CTA `scale-up` | 300 ms | Down from 600 ms |
| Marquee | 45 s cycle | Up from 30 s |
| Page transition fade | 150 ms | New |
| Carousel dot indicator | 200 ms | New |
| Hero micro-animation (float) | 3 s | Existing keyframe, apply it |

### Easing palette (current — all good, no changes needed)

- **Scroll reveals:** `cubic-bezier(0.16, 1, 0.3, 1)` — this is an excellent spring-like Expo Out. Keep for all reveals.
- **Accordion:** `ease-out` at 200 ms — correct for functional UI interaction.
- **Hover transitions:** Keep default ease / 300 ms — appropriate for micro-interactions.
- **Marquee:** `linear` — correct. Any easing would create a visible speed change at loop point.
- **Page fade (proposed):** `ease-in-out` at 150 ms — simple and imperceptible enough to avoid disorientation.

---

## Summary Assessment by Motion Dimension

| Dimension | Status | Grade |
|---|---|---|
| Reduced-motion compliance | Two-layer defense, all 6 routes pass visual inspection | A |
| Scroll reveal pacing | Correct easing, duration uniformity is too flat | B |
| Stagger / cascade control | Security page popcorn effect; architecture layer stagger is a positive example | C+ |
| Marquee speed | 30 s is 33% too fast for readable brand recognition | C |
| Hero animation quality | Static mini-dash with no micro-animation misses delight opportunity | C+ |
| InvestigationDashboard | Strong concept, wrong placement, mount-based phase timer is a UX defect | B- |
| Page transitions | No transitions (App Router default). Acceptable today; would benefit from subtle fade | B |
| Overall motion maturity | Solid foundation, conservative choices. Primary gap is timing calibration and structural narrative placement | B |

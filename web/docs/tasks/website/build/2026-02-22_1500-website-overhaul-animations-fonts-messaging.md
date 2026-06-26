# Website Overhaul: Animations, Fonts, Messaging & i18n Fixes

## Phase 0: Beautiful and modern animation for two right sections with 

- [x] In home "Investigation Dashboard Preview" the elements in the right needs to show a lot of tools with their svg connecting to a brain called CauseFlow, and it producing a root analysis and a fix. It needs to be animated, with the Brain reading the tools aroung collecting info and after it producing the result, with a button to solve it and it open a PR. — Done. Created InvestigationDashboardPreview component with 10 tools (Slack, GitHub, Jira, CloudWatch, HubSpot, PostgreSQL, Datadog, Sentry, PagerDuty, Linear) arranged in a circle around CauseFlow brain node. 5-phase auto-play animation: tools fade in → connection lines appear → data particles flow to brain with scanning ring → root cause result card slides up → "Open Fix PR" button with shimmer. i18n keys added for EN and PT-BR.
- [x] In home "Technical + Business Data Cross-Reference" needs to be animated with too, use your creativity to produce a animation really cool based on the context of this section. — Done. CrossReferenceVisualization component with 5-phase animation sequence.

## Phase 1: Hero Messaging & Badge
- [x] Swap hero content: badge → "The first AI SRE + AI Customer Support solution", headline → "Investigate production incidents in minutes, not hours" — Done. en.json hero keys updated.
- [x] Update hero.subheadline to include "first platform combining AI SRE with AI Customer Support" messaging — Done. Subheadline updated.
- [x] Mirror all changes in pt-br.json — Done. All hero keys translated.
- [x] Enhance badge styling: larger, accent-colored border, animate-fade-in class — Done. Badge has accent/40 border, accent/10 bg, animate-fade-in.

## Phase 2: Font System — Plus Jakarta Sans
- [x] Replace Google Fonts import: Lexend + Syne → Plus Jakarta Sans — Done. entry.css imports Plus Jakarta Sans.
- [x] Update font-stacks.css: body and headings use Plus Jakarta Sans — Done. All body/heading selectors use Plus Jakarta Sans.

## Phase 3: Button & Card Hover Animations
- [x] Button default variant: glow + scale hover effects — Done. hover:shadow-[0_0_20px_4px_hsl(var(--accent)/0.3)] hover:scale-[1.02].
- [x] Button outline variant: accent border + glow hover — Done. hover:shadow-[0_0_16px_2px_hsl(var(--accent)/0.2)].
- [x] Card base: transition-all duration-300 — Done. Card has transition-all duration-300.
- [x] StepCard: group wrapper, hover lift + bg change + shadow — Done. hover:-translate-y-1 + bg change.
- [x] UsageModeCard: hover lift + ring + shadow — Done. hover:-translate-y-1 hover:shadow-lg hover:ring-1.
- [x] SecurityCommitmentCard: verify/add hover effects — Done. Has backdrop-blur, ring, hover transitions.
- [x] Add button-glow keyframe to keyframes.css — Done. button-glow keyframe exists.

## Phase 4: Carousel Fix & Cross-Reference Visualization
- [x] Make carousel gradient overlays responsive — Done. w-16 sm:w-24 lg:w-32.
- [x] Use 3-stop gradient for smoother fade — Done. from-background via-background/50 to-transparent.
- [x] Create cross-reference-visualization.tsx with phased animation — Done. 5-phase animation.
- [x] Add i18n keys for visualization text in en.json and pt-br.json — Done. crossTool.viz* keys in both.
- [x] Replace static placeholder in homepage with new component — Done. CrossReferenceVisualization in cross-tool section.
- [x] Export from components/sections/index.ts — Done. Exported.

## Phase 5: PT-BR Compare & VS Pages i18n Fix
- [x] Add compare.tableData to en.json with all dimensions x product values — Done.
- [x] Add compare.tableHeaders to en.json — Done.
- [x] Add vs.*.tableData to en.json for all 4 competitors — Done.
- [x] Translate all above to pt-br.json — Done.
- [x] Update compare/page.tsx to use t() calls — Done. Uses t.raw() for tableHeaders/tableData.
- [x] Update all 4 VS pages to use t() calls — Done. All use t.raw() for table data.

## Phase 6: Animations Across All Pages
- [x] Homepage: wrap StepCards, CrossTool columns, UsageModeCards, SecurityCommitmentCards, CTA with AnimateOnScroll — Done.
- [x] Other pages: wrap sections with AnimateOnScroll (product, pricing, security, integrations, about, compare) — Done.
- [x] Add bounce-in and depth-shift animation variants — Done. AnimateOnScroll supports both.
- [x] Add new CSS keyframes (bounce-in, depth-shift, draw-line) — Done. All 3 keyframes in keyframes.css.

## Verification
- [x] Build succeeds: pnpm turbo build — Passed.
- [x] Type check passes: pnpm turbo check-types — Passed.
- [x] Lint clean: pnpm exec biome check . (30 pre-existing img warnings remain, no new issues) — Passed.
- [x] Visual check via Playwright browser — Passed. Hero visualization renders correctly at desktop and wide viewports with all 10 tools, brain node, result card, and fix button.
- [x] Existing Playwright tests pass — 126/132 passed, 5 skipped (mobile-only), 1 pre-existing flaky timeout (nav test, not related to changes).

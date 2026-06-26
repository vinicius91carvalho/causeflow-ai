# Animation & Brain Logo Improvements

## Phase 1: Research & Setup
- [x] Explore animation components (investigation-dashboard-preview, cross-reference-visualization)
- [x] Read favicon SVG
- [x] Read header and mobile-menu brand components
- [x] Commit all pending changes before starting

## Phase 2: Use favicon.svg as brand logo
- [x] Update favicon.svg and apple-icon.svg colors from #00ff88 to #2bd3bd (theme accent teal)
- [x] Add favicon.svg as `<img>` in header brand (left of "CauseFlow AI")
- [x] Add favicon.svg as `<img>` in mobile menu brand

## Phase 3: Update Animation Components
- [x] Make tool circles bigger in investigation-dashboard-preview (r=20 -> r=26)
- [x] Make tool circles bigger in cross-reference-visualization (r=22 -> r=28)
- [x] Replace simple brain drawing in center with favicon brain SVG in both animations
- [x] Delay root cause card to appear AFTER brain finishes consuming data (after phase 3 scanning completes)
- [x] Add circulating light border effect on the root cause card (border-only, not radial fill)

## Phase 4: Validation
- [x] Build passes
- [x] Visual check with Playwright screenshots

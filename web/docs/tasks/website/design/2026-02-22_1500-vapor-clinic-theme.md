# Create "Vapor Clinic" Theme — Neon Biotech Identity

## Phase 1: Research & Setup
- [x] Explore existing theme structure (THEMES.md, existing theme files)
- [x] Identify patterns for tokens, fonts, animations, utilities
- [x] Create vapor-clinic directory structure

## Phase 2: Implementation
- [x] Create tokens/light.css with accurate HSL conversions
- [x] Create tokens/dark.css with electric neon dark mode
- [x] Create fonts/font-stacks.css with Sora, Instrument Serif, Fira Code
- [x] Create animations/keyframes.css (all base + vapor-specific)
- [x] Create animations/utilities.css (all base + vapor-specific)
- [x] Create empty image directories with .gitkeep files
- [x] Update entry.css to import all vapor-clinic theme files

## Phase 3: Validation
- [x] Verify all CSS selectors use [data-theme="vapor-clinic"]
- [x] Verify HSL conversions are accurate
- [x] Verify dark mode selector is [data-theme="vapor-clinic"].dark
- [x] Run biome lint check
- [x] Verify no bare :root selectors

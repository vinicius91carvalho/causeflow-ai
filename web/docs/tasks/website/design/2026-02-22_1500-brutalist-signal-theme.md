# Create "Brutalist Signal" Theme

## Phase 1: Research & Setup
- [x] Explore existing theme structure (THEMES.md, existing theme files)
- [x] Identify all CSS files and patterns to replicate
- [x] Create directory structure for brutalist-signal theme

## Phase 2: Implementation
- [x] Create tokens/light.css with HSL color mappings
- [x] Create tokens/dark.css with dark mode variants
- [x] Create fonts/font-stacks.css with Space Grotesk, DM Serif Display, Space Mono
- [x] Create animations/keyframes.css (copy base + add brutalist-specific)
- [x] Create animations/utilities.css (copy base + add brutalist-specific)
- [x] Create empty image directories with .gitkeep files
- [x] Create entry.css to import all theme files

## Phase 3: Validation
- [x] Verify all CSS selectors use [data-theme="brutalist-signal"] scoping
- [x] Verify HSL values are accurate conversions from hex
- [x] Verify dark mode uses [data-theme="brutalist-signal"].dark selector
- [x] Verify all animation keyframes from original theme are included
- [x] Run biome check on new files
- [x] Run build to verify no errors

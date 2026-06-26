# Create Themes Folder Structure + Documentation

## Phase 1: Create Folder Structure
- [x] Create themes directory tree (original/tokens, animations, fonts, images, shared, _template)
- [x] Create .gitkeep files for empty directories

## Phase 2: Split globals.css into Theme Modules
- [x] Create shared/base.css (@theme directive + @layer base shared rules)
- [x] Create original/tokens/light.css (:root block)
- [x] Create original/tokens/dark.css (.dark block)
- [x] Create original/fonts/font-stacks.css (font-family declarations)
- [x] Create original/animations/keyframes.css (@keyframes definitions)
- [x] Create original/animations/utilities.css (@utility definitions)
- [x] Create entry.css (single CSS entry point)

## Phase 3: Move Animation Components
- [x] Move use-animate-on-scroll.ts to themes/original/animations/hooks/
- [x] Move animate-on-scroll.tsx to themes/original/animations/components/
- [x] Move typing-animation.tsx to themes/original/animations/components/
- [x] Move count-up.tsx to themes/original/animations/components/
- [x] Create barrel exports (index.ts) for components and hooks
- [x] Update internal imports in moved files
- [x] Delete original animation files from apps/website

## Phase 4: TypeScript Infrastructure
- [x] Create types.ts (ThemeDefinition, ThemeId, ColorMode)
- [x] Create index.ts (theme registry + re-exports)
- [x] Create provider.tsx (ThemeProvider skeleton)

## Phase 5: Update Package Exports
- [x] Update packages/ui/package.json exports map
- [x] Update packages/ui/src/index.ts to re-export themes

## Phase 6: Delete Old Files
- [x] Delete packages/ui/src/styles/globals.css
- [x] Delete packages/ui/src/styles/ directory

## Phase 7: Write THEMES.md Documentation
- [x] Create packages/ui/src/themes/THEMES.md

## Phase 8: Verification
- [x] pnpm turbo build — no broken imports
- [x] pnpm turbo check-types — TypeScript passes
- [x] pnpm exec biome check . — linting passes (1 pre-existing warning only)
- [x] Website dev server starts and renders correctly

# Implement 4 Cinematic Theme Presets + JSON Config System

## Context
Implement all 4 aesthetic presets from the cinematic landing page spec as isolated themes, plus a JSON-based theme config system for easy switching. Each theme is self-contained inside `packages/ui/src/themes/<name>/`. The original theme stays as-is.

Themes to create:
1. **organic-tech** — Clinical Boutique (Moss + Clay)
2. **midnight-luxe** — Dark Editorial (Obsidian + Champagne)
3. **brutalist-signal** — Raw Precision (Paper + Signal Red)
4. **vapor-clinic** — Neon Biotech (Deep Void + Plasma)

## Files to Modify
- `packages/ui/src/themes/config.json` (NEW — theme registry config)
- `packages/ui/src/themes/index.ts` (update registry to read config)
- `packages/ui/src/themes/types.ts` (add preset metadata)
- `packages/ui/src/themes/entry.css` (import all theme CSS, scoped)
- `packages/ui/src/themes/organic-tech/` (NEW — full theme folder)
- `packages/ui/src/themes/midnight-luxe/` (NEW — full theme folder)
- `packages/ui/src/themes/brutalist-signal/` (NEW — full theme folder)
- `packages/ui/src/themes/vapor-clinic/` (NEW — full theme folder)
- `packages/ui/src/themes/THEMES.md` (update with all themes)

## Phase 1: JSON Config System
- [x] Create `packages/ui/src/themes/config.json` with all 5 themes listed and `defaultTheme` field
- [x] Update `packages/ui/src/themes/index.ts` to register all 5 themes with full metadata
- [x] Update `packages/ui/src/themes/types.ts` to add preset metadata (identity, imageMood, heroPattern)
- [x] Original theme stays on `:root` as fallback — new themes override via `[data-theme]` specificity

## Phase 2: Create Theme Folders (parallel — 4 subagents)
Each theme folder clones the original structure:
```
<theme-name>/
├── tokens/
│   ├── light.css    # [data-theme="<name>"] { HSL values }
│   └── dark.css     # [data-theme="<name>"].dark { HSL values }
├── fonts/
│   └── font-stacks.css   # Font families per preset spec
├── animations/
│   ├── keyframes.css     # Theme-specific keyframes (shared base + extras)
│   └── utilities.css     # Theme-specific @utility classes
└── images/
    ├── brand/
    ├── illustrations/
    └── icons/
```

### Theme A: Organic Tech
- [x] Create folder structure `packages/ui/src/themes/organic-tech/`
- [x] Create `tokens/light.css` — Moss #2E4036 primary, Clay #CC5833 accent, Cream #F2F0E9 bg
- [x] Create `tokens/dark.css` — dark mode variants
- [x] Create `fonts/font-stacks.css` — Plus Jakarta Sans + Outfit headings, Cormorant Garamond drama, IBM Plex Mono
- [x] Create `animations/keyframes.css` — base keyframes + organic-breathe, leaf-sway
- [x] Create `animations/utilities.css` — matching utilities

### Theme B: Midnight Luxe
- [x] Create folder structure `packages/ui/src/themes/midnight-luxe/`
- [x] Create `tokens/light.css` — Obsidian #0D0D12 primary, Champagne #C9A84C accent, Ivory #FAF8F5 bg
- [x] Create `tokens/dark.css` — dark mode variants
- [x] Create `fonts/font-stacks.css` — Inter headings, Playfair Display drama, JetBrains Mono
- [x] Create `animations/keyframes.css` — base keyframes + golden-shimmer, luxe-reveal
- [x] Create `animations/utilities.css` — matching utilities

### Theme C: Brutalist Signal
- [x] Create folder structure `packages/ui/src/themes/brutalist-signal/`
- [x] Create `tokens/light.css` — Paper #E8E4DD primary, Signal Red #E63B2E accent, Off-white #F5F3EE bg
- [x] Create `tokens/dark.css` — dark mode variants
- [x] Create `fonts/font-stacks.css` — Space Grotesk headings, DM Serif Display drama, Space Mono
- [x] Create `animations/keyframes.css` — base keyframes + signal-flash, hard-cut
- [x] Create `animations/utilities.css` — matching utilities

### Theme D: Vapor Clinic
- [x] Create folder structure `packages/ui/src/themes/vapor-clinic/`
- [x] Create `tokens/light.css` — Deep Void #0A0A14 primary, Plasma #7B61FF accent, Ghost #F0EFF4 bg
- [x] Create `tokens/dark.css` — dark mode variants
- [x] Create `fonts/font-stacks.css` — Sora headings, Instrument Serif drama, Fira Code
- [x] Create `animations/keyframes.css` — base keyframes + neon-pulse, plasma-wave, bioluminescence
- [x] Create `animations/utilities.css` — matching utilities

## Phase 3: Wire All Themes into entry.css
- [x] Add Google Fonts imports for all 4 new themes' font families
- [x] Import all theme token CSS files (scoped with `[data-theme]`)
- [x] Import all theme font-stacks CSS files
- [x] Import all theme animation CSS files
- [x] Verify no theme leaks into another (isolation check)

## Phase 4: Update Documentation
- [x] Update `packages/ui/src/themes/THEMES.md` with all 5 themes documented
- [x] Document the JSON config system and how to switch themes

## Phase 5: Build & Validate
- [x] Run `pnpm turbo build` — 5/5 successful
- [x] Run `pnpm turbo check-types` — 10/10 successful, zero type errors
- [x] Run `pnpm exec biome check .` — 38 files checked, zero lint issues
- [x] Verify theme isolation (each theme's CSS only activates under its `data-theme`)

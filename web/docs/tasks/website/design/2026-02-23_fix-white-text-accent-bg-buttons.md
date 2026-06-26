# Fix White Text on Accent Backgrounds & Button Hover Styles

## Phase 1: Research
- [x] Identify all components with white text on accent backgrounds
- [x] Identify all button hover style issues

## Phase 2: Fix Card Components (white → accent-foreground on hover)
- [x] feature-card.tsx
- [x] pricing-card.tsx
- [x] usage-mode-card.tsx
- [x] security-commitment-card.tsx
- [x] competitor-vs-banner.tsx
- [x] product/page.tsx (inline cards)
- [x] security/page.tsx (inline cards)

## Phase 3: Fix Button Hover Styles (dark bg + green text on hover)
- [x] button.tsx — outline & ghost variants: keep dark bg, text becomes accent (teal)
- [x] hero-section.tsx — remove hardcoded dark mode overrides
- [x] cta-section.tsx — remove hardcoded dark mode overrides

## Phase 4: Validation
- [x] Build successfully
- [x] Screenshots to verify

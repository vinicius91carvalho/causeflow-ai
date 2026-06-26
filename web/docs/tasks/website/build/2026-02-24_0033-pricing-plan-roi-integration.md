# Pricing Plan Selection → ROI Calculator Integration

## Phase 1: Research & Setup
- [x] Read pricing-card.tsx
- [x] Read roi-calculator.tsx
- [x] Read pricing/page.tsx

## Phase 2: Implementation
- [x] Edit pricing-card.tsx — add `selected` and `onSelect` props, "Calculate ROI" button, selected ring highlight
- [x] Edit roi-calculator.tsx — add `initialIncidents` prop wired via useEffect
- [x] Create pricing-interactive.tsx — client component managing plan state and scroll behavior
- [x] Edit pricing/page.tsx — replace inline grid + ROI section with PricingInteractive

## Phase 3: Validation
- [x] TypeScript check — no errors in modified files (pre-existing errors in shared/competitors.ts and compare/page.tsx unrelated to this task)
- [x] Build check — no errors from pricing-related files

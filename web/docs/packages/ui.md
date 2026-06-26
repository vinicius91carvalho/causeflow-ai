# @causeflow/ui

Design system for CauseFlow AI. Provides reusable UI components, layout primitives, animation helpers, hooks, and a multi-theme system used by both `apps/website` and `apps/dashboard`.

## Component Library

All components are built on Radix UI primitives with class-variance-authority (CVA) for variant management and Tailwind CSS for styling.

### Primitives (15+)

| Component | Radix Primitive | Notes |
|---|---|---|
| `Button` | — | Variants: default, destructive, outline, ghost, link. Sizes: sm, md, lg |
| `Input` | — | Controlled text input with error state support |
| `Dialog` | `@radix-ui/react-dialog` | Modal with overlay, header, footer slots |
| `Tabs` | `@radix-ui/react-tabs` | Accessible tab panels |
| `Select` | `@radix-ui/react-select` | Dropdown select with search |
| `Accordion` | `@radix-ui/react-accordion` | Collapsible FAQ/content sections |
| `Badge` | — | Inline labels. Variants: default, secondary, destructive, outline |
| `Card` | — | Container with header, content, footer sub-components |
| `Slider` | `@radix-ui/react-slider` | Range input (used in ROI calculator) |
| `Table` | — | Data table with thead/tbody/tfoot primitives |
| `Tooltip` | `@radix-ui/react-tooltip` | Hover tooltips |
| `DropdownMenu` | `@radix-ui/react-dropdown-menu` | Context/action menus |
| `Sheet` | `@radix-ui/react-dialog` | Side-panel drawer |
| `Switch` | `@radix-ui/react-switch` | Toggle switch |
| `Avatar` | `@radix-ui/react-avatar` | User avatar with fallback initials |

## Layout Components

| Component | Props | Use Case |
|---|---|---|
| `PageLayout` | `children, className?` | Full-page wrapper with header + footer |
| `SectionLayout` | `children, id?, className?` | Section with consistent vertical padding |
| `GridLayout` | `children, cols?, gap?` | Responsive CSS grid container |
| `TwoColumnLayout` | `left, right, reverse?` | 50/50 or asymmetric two-column splits |
| `LegalPageLayout` | `children, title, lastUpdated` | Prose layout for Privacy/Terms pages |

## Hooks

| Hook | Returns | Description |
|---|---|---|
| `useMediaQuery` | `boolean` | Evaluates a CSS media query string reactively |
| `useScrollPosition` | `{ x, y, direction }` | Tracks scroll position and direction |

```typescript
import { useMediaQuery, useScrollPosition } from '@causeflow/ui/hooks'

const isDesktop = useMediaQuery('(min-width: 1024px)')
const { y, direction } = useScrollPosition()
```

## Animation Components

| Component | Props | Description |
|---|---|---|
| `AnimateOnScroll` | `children, animation, delay?, threshold?` | Intersection Observer-based entrance animation |
| `CountUp` | `to, duration?, format?` | Animated number counter for metrics/stats |
| `TypingAnimation` | `texts[], speed?, pause?` | Typewriter effect for hero headings |

## Utility: cn()

Combines `clsx` and `tailwind-merge` to safely compose Tailwind class names:

```typescript
import { cn } from '@causeflow/ui/utils'

cn('px-4 py-2', isActive && 'bg-primary', className)
// Merges correctly — no duplicate or conflicting classes
```

## Theme System

Themes live in `packages/ui/src/themes/`. Each theme is fully self-contained.

### Available Themes

| Theme ID | Display Name | Character |
|---|---|---|
| `original` | CauseFlow Original | Clean, technical, trust-focused |
| `organic-tech` | Organic Tech | Warm greens, natural curves |
| `midnight-luxe` | Midnight Luxe | Dark, premium, high contrast |
| `brutalist-signal` | Brutalist Signal | Bold, high-impact, editorial |
| `vapor-clinic` | Vapor Clinic | Soft purples, futuristic minimal |

### Theme Folder Structure

```
packages/ui/src/themes/<theme-id>/
├── entry.css          # Theme entry point — imports all layers
├── tokens/
│   ├── light.css      # CSS variable values for light mode
│   └── dark.css       # CSS variable values for dark mode
├── animations.css     # Theme-specific keyframes (optional)
├── fonts.css          # Font face declarations + preloads
└── images/            # Theme-specific background/texture assets
```

### Two-Layer Tailwind v4 Architecture

The theme system uses two CSS layers to separate semantic names from values:

**Layer 1 — `packages/ui/src/shared/base.css` (semantic mapping)**

Maps Tailwind utility names to semantic CSS variables:

```css
@theme {
  --color-primary: var(--color-primary);
  --color-background: var(--color-background);
  --color-foreground: var(--color-foreground);
  /* ... */
}
```

**Layer 2 — `tokens/light.css` + `tokens/dark.css` (theme values)**

Each theme sets the actual HSL values:

```css
/* tokens/light.css */
:root {
  --color-primary: 221 83% 53%;
  --color-background: 0 0% 100%;
  --color-foreground: 222 47% 11%;
}

/* tokens/dark.css */
.dark {
  --color-primary: 217 91% 60%;
  --color-background: 222 47% 8%;
  --color-foreground: 213 31% 91%;
}
```

### Dark Mode

Dark mode is activated by adding the `.dark` class to the `<html>` element. No `prefers-color-scheme` media query — explicit user control only.

```typescript
// Toggle dark mode:
document.documentElement.classList.toggle('dark')
```

### Creating a New Theme

See `packages/ui/src/themes/THEMES.md` for the full specification including:
- Required CSS variable reference (all semantic tokens that must be defined)
- Step-by-step folder creation guide
- Font integration instructions
- Animation guidelines

## Dependencies

| Package | Purpose |
|---|---|
| `@radix-ui/*` | Accessible headless primitives |
| `class-variance-authority` | Component variant definitions |
| `clsx` | Conditional class name joining |
| `tailwind-merge` | Tailwind class conflict resolution |
| `lucide-react` | Icon library |

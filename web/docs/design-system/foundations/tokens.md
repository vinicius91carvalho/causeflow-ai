# Tokens

Canonical reference for design tokens. Tokens are CSS custom properties defined per theme and mapped to Tailwind's `@theme` namespace via `packages/ui/src/themes/shared/base.css`. All values below are pulled from the `original` theme (`packages/ui/src/themes/original/tokens/{light,dark}.css`).

Tokens follow the shadcn/ui convention: colors are stored as raw HSL triples (`H S% L%`) and consumed as `hsl(var(--token))`. This allows alpha-channel composition (`hsl(var(--accent) / 0.2)`) without re-declaring the color.

## Color System

All color tokens come in semantic pairs: a surface (`--primary`) and its readable foreground (`--primary-foreground`). Always use the pair together — never put arbitrary text on a semantic surface.

### Semantic colors

| Token | Purpose | Light (original) | Dark (original) |
|---|---|---|---|
| `--background` | Page background | `230 18% 95%` | `232 35% 6%` |
| `--foreground` | Default body text | `232 45% 10%` | `210 40% 96%` |
| `--card` | Elevated surface (cards, sheets) | `230 20% 97%` | `232 30% 10%` |
| `--card-foreground` | Text on cards | `232 45% 10%` | `210 40% 96%` |
| `--popover` | Floating surfaces (popover, menu) | `230 20% 97%` | `232 30% 10%` |
| `--popover-foreground` | Text in popovers | `232 45% 10%` | `210 40% 96%` |
| `--primary` | Primary action (filled button, brand surface) | `232 50% 18%` | `172 66% 50%` |
| `--primary-foreground` | Text/icon on `--primary` | `0 0% 98%` | `232 35% 6%` |
| `--secondary` | Quiet surface (secondary button, chip) | `230 15% 93%` | `232 25% 16%` |
| `--secondary-foreground` | Text on `--secondary` | `232 50% 18%` | `210 40% 96%` |
| `--muted` | Sidebar, headers, hover state | `230 15% 93%` | `232 25% 16%` |
| `--muted-foreground` | Secondary / helper text | `232 12% 44%` | `232 12% 68%` |
| `--accent` | Highlights, hover emphasis, links | `172 66% 30%` | `172 66% 50%` |
| `--accent-foreground` | Text on `--accent` | `0 0% 98%` | `232 35% 6%` |
| `--warning` | Attention, non-blocking warnings, secondary CTA | `23 90% 52%` | `23 90% 52%` |
| `--warning-foreground` | Text on `--warning` | `0 0% 100%` | `0 0% 100%` |
| `--destructive` | Error, irreversible action | `0 72% 51%` | `0 63% 51%` |
| `--destructive-foreground` | Text on `--destructive` | `0 0% 98%` | `210 40% 96%` |
| `--success` | Success state | `160 84% 39%` | `160 84% 42%` |
| `--success-foreground` | Text on `--success` | `0 0% 98%` | `210 40% 96%` |
| `--border` | Default hairline border | `230 15% 87%` | `232 25% 18%` |
| `--input` | Input border / empty input surface | `230 15% 87%` | `232 25% 18%` |
| `--ring` | Focus ring (must pair with `:focus-visible`) | `172 66% 30%` | `172 66% 50%` |

### Chart colors

Reserved for data visualisation. Do not reuse for UI chrome.

| Token | Light | Dark |
|---|---|---|
| `--chart-1` | `172 66% 30%` | `172 66% 55%` |
| `--chart-2` | `232 50% 45%` | `232 50% 60%` |
| `--chart-3` | `43 96% 56%` | `43 96% 62%` |
| `--chart-4` | `280 65% 60%` | `280 65% 65%` |
| `--chart-5` | `0 72% 51%` | `0 72% 58%` |

### Consuming colors

```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Investigate
</button>

<div className="border border-border bg-card text-card-foreground">…</div>

// Alpha:
<span className="ring-2 ring-accent/40" />
```

### Where to override

- **Semantic → Tailwind mapping:** [`packages/ui/src/themes/shared/base.css`](../../../packages/ui/src/themes/shared/base.css). Rarely changes.
- **Per-theme values:** [`packages/ui/src/themes/<theme>/tokens/light.css`](../../../packages/ui/src/themes/original/tokens/light.css) and `dark.css`. Changing values in the `original` theme changes the default look across both apps.

## Radius

Radii are derived from a single base token so changing `--radius` cascades. Defined in `shared/base.css`.

| Token | Value | Example use |
|---|---|---|
| `--radius` | `0.625rem` (10px) — set per theme | Base — the "lg" radius |
| `--radius-sm` | `calc(var(--radius) - 4px)` → `0.375rem` | Small chips, inline tags |
| `--radius-md` | `calc(var(--radius) - 2px)` → `0.5rem` | Buttons, inputs, menu items |
| `--radius-lg` | `var(--radius)` → `0.625rem` | Cards, dialog surfaces |
| `--radius-xl` | `calc(var(--radius) + 4px)` → `0.875rem` | Hero cards, modal shell |

Tailwind classes: `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`. Override `--radius` in a theme's `light.css` / `dark.css` to rescale all four tiers at once.

## Spacing

Uses Tailwind v4 defaults — no custom spacing tokens. The base step is `0.25rem` (4px). Reference scale (most-used slice):

| Class | rem | px |
|---|---|---|
| `gap-1` / `p-1` | `0.25` | 4 |
| `gap-2` / `p-2` | `0.5` | 8 |
| `gap-3` / `p-3` | `0.75` | 12 |
| `gap-4` / `p-4` | `1` | 16 |
| `gap-6` / `p-6` | `1.5` | 24 |
| `gap-8` / `p-8` | `2` | 32 |
| `gap-12` / `p-12` | `3` | 48 |
| `gap-16` / `p-16` | `4` | 64 |

**Guidelines.** Pad cards with `p-4` / `p-6`. Stack form fields with `gap-4`. Section vertical rhythm on marketing pages: `py-16` (mobile) → `py-24` (desktop). Avoid ad-hoc pixel values — always use the scale.

## Typography

Font families are registered in [`packages/ui/src/themes/original/fonts/font-stacks.css`](../../../packages/ui/src/themes/original/fonts/font-stacks.css) and declared per theme in the theme registry (`packages/ui/src/themes/index.ts`).

| Role | Original theme | Fallback stack |
|---|---|---|
| Sans (body) | `var(--font-jakarta)` → Plus Jakarta Sans | `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` |
| Display (headings) | Plus Jakarta Sans | same as sans |
| Mono (code, kbd) | JetBrains Mono | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` |

Other themes ship different font choices (declared in `index.ts`):

- `organic-tech` — sans: Plus Jakarta Sans, display: Outfit, drama: Cormorant Garamond, mono: IBM Plex Mono
- `midnight-luxe` — sans: Inter, drama: Playfair Display, mono: JetBrains Mono
- `brutalist-signal` — sans: Space Grotesk, drama: DM Serif Display, mono: Space Mono
- `vapor-clinic` — sans: Sora, drama: Instrument Serif, mono: Fira Code

### Sizes and weights

Uses Tailwind defaults. Recommended scale:

| Use | Class | Weight |
|---|---|---|
| Hero headline | `text-5xl md:text-6xl lg:text-7xl` | `font-extrabold` (800) |
| Section heading | `text-3xl md:text-4xl` | `font-bold` (700) |
| Card title | `text-xl` | `font-semibold` (600) |
| Body | `text-base` | `font-normal` (400) |
| Small / helper | `text-sm` | `font-normal` (400) |
| Micro (legal, timestamp) | `text-xs` | `font-medium` (500) |

Headings default to `font-bold` (700) — `h1` is bumped to `font-extrabold` (800) in `font-stacks.css`.

### Where to override

- Font stack: [`packages/ui/src/themes/<theme>/fonts/font-stacks.css`](../../../packages/ui/src/themes/original/fonts/font-stacks.css)
- Font family assignment per theme: [`packages/ui/src/themes/index.ts`](../../../packages/ui/src/themes/index.ts)

## Motion

Animation primitives live under [`packages/ui/src/themes/original/animations/`](../../../packages/ui/src/themes/original/animations/) and are exposed as Tailwind utilities (Tailwind v4 `@utility` directive).

### Durations (from `utilities.css`)

| Utility | Duration | Easing | Use |
|---|---|---|---|
| `animate-fade-in` | `0.5s` | `ease-out` | Initial reveal, toast enter |
| `animate-fade-in-up` | `0.6s` | `ease-out` | Scroll-triggered hero reveal |
| `animate-fade-in-down` | `0.6s` | `ease-out` | Dropdown / notice enter |
| `animate-slide-in-left` / `-right` | `0.5s` | `ease-out` | Sheet enter |
| `animate-scale-up` | `0.5s` | `ease-out` | Card hover emphasis |
| `animate-bounce-in` | `0.6s` | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | Success confirmation |
| `animate-depth-shift` | `0.5s` | `ease-out` | Dialog enter |
| `animate-accordion-down` / `-up` | `0.2s` | `ease-out` | Accordion toggle |
| `animate-shimmer` | `2.5s` linear infinite | — | Skeleton loading |
| `animate-float` | `3s` ease-in-out infinite | — | Passive hero decoration |
| `animate-glow-pulse` / `animate-button-glow` | `2s` ease-in-out infinite | — | Accent pulsing |
| `animate-scroll` / `-reverse` | `30s` linear infinite | — | Marquee / logo belt |
| `animate-pulse-ring` | `1.5s` ease-out infinite | — | Live indicator |

### Easings used

- `ease-out` — default for entrance animations
- `ease-in-out` — default for infinite, ambient motion
- `linear` — marquees, shimmer
- `cubic-bezier(0.68, -0.55, 0.265, 1.55)` — playful bounce (use sparingly)

### Reduced motion

`shared/base.css` forces `animation-duration: 0.01ms` and clears transforms/opacity on scroll-reveal classes whenever `prefers-reduced-motion: reduce` is set. This is mandatory — do not override it. See [`foundations/accessibility.md`](./accessibility.md#reduced-motion) for the rules.

### Where to override

- Keyframe definitions: [`packages/ui/src/themes/<theme>/animations/keyframes.css`](../../../packages/ui/src/themes/original/animations/keyframes.css)
- Utility bindings: [`packages/ui/src/themes/<theme>/animations/utilities.css`](../../../packages/ui/src/themes/original/animations/utilities.css)
- High-level React wrappers: `AnimateOnScroll`, `TypingAnimation`, `CountUp` — exported from `@causeflow/ui`

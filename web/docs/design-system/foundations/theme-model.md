# Theme Model

CauseFlow supports multiple brand-level themes. The system is built on a two-layer token architecture that is compatible with Tailwind v4 and keeps theme switching a pure CSS concern.

## Two-layer Token Architecture

### Layer 1 — Semantic mapping (shared)

[`packages/ui/src/themes/shared/base.css`](../../../packages/ui/src/themes/shared/base.css) declares a single `@theme` block that maps Tailwind's semantic color names to CSS custom properties. This file is shared across every theme and almost never changes.

```css
@theme {
  --color-primary: hsl(var(--primary));
  --color-accent: hsl(var(--accent));
  --color-destructive: hsl(var(--destructive));
  /* ... */
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
}
```

Tailwind sees `--color-primary` and generates `bg-primary`, `text-primary`, `border-primary`, etc. The variables it resolves to (`--primary`, `--accent`, `--radius`) are *not set here* — they are set by the active theme.

### Layer 2 — Token values (per theme)

Each theme ships `tokens/light.css` and (optionally) `tokens/dark.css` that set the HSL triples and the `--radius` base value. Example:

```css
/* original/tokens/light.css */
:root,
[data-theme="original"] {
  --background: 230 18% 95%;
  --foreground: 232 45% 10%;
  --primary: 232 50% 18%;
  --accent: 172 66% 30%;
  --radius: 0.625rem;
}

/* original/tokens/dark.css */
.dark,
[data-theme="original"].dark {
  --background: 232 35% 6%;
  --primary: 172 66% 50%;
}
```

Because consumers only reference semantic names (`bg-primary`), switching themes is just replacing the variable values — no component code changes.

## Light / Dark Mode

- **Light:** default. Values come from `:root` / `[data-theme="<id>"]`.
- **Dark:** activated by adding the `.dark` class to the `<html>` element. Values come from `.dark` / `[data-theme="<id>"].dark`.
- **System:** defer to the user's OS preference via `prefers-color-scheme`.

The `ThemeProvider` (`packages/ui/src/themes/provider.tsx`) owns:

1. The `data-theme` attribute on `<html>` (theme selection).
2. The `.dark` class on `<html>` (color mode).
3. Reading and persisting the user's preference (color mode + theme id).

```tsx
// app/layout.tsx
import { ThemeProvider } from '@causeflow/ui';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider defaultColorMode="system">{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

`suppressHydrationWarning` on `<html>` is required because `ThemeProvider` mutates the `class` attribute after hydration.

## How Themes Are Loaded

There is one CSS entry point: [`packages/ui/src/themes/entry.css`](../../../packages/ui/src/themes/entry.css). It is imported once per app (e.g. `apps/website/src/app/globals.css`) and pulls in everything:

```css
@import "tailwindcss";
@source "..";
@source "../../../../apps/website/src";
@source "../../../../apps/dashboard/src";
@import "tw-animate-css";
@plugin "@tailwindcss/typography";

/* Shared token mapping (used by all themes) */
@import "./shared/base.css";

/* Original theme (fallback — uses :root) */
@import "./original/tokens/light.css";
@import "./original/tokens/dark.css";
@import "./original/fonts/font-stacks.css";
@import "./original/animations/keyframes.css";
@import "./original/animations/utilities.css";

/* Additional themes — tokens only. Fonts are loaded dynamically by ThemeProvider
   via Google Fonts <link>, and animations remain per-theme (uncomment when active). */
@import "./organic-tech/tokens/light.css";
@import "./organic-tech/tokens/dark.css";
@import "./midnight-luxe/tokens/light.css";
@import "./midnight-luxe/tokens/dark.css";
@import "./brutalist-signal/tokens/light.css";
@import "./brutalist-signal/tokens/dark.css";
@import "./vapor-clinic/tokens/light.css";
@import "./vapor-clinic/tokens/dark.css";
```

All theme tokens are bundled so `[data-theme="<id>"]` selectors work at runtime without a reload. Fonts for non-`original` themes are loaded lazily via Google Fonts links injected by `ThemeProvider`. Animations/utilities remain per-theme — uncomment the imports when a non-default theme is promoted to production.

## Existing Themes

Registered in [`packages/ui/src/themes/index.ts`](../../../packages/ui/src/themes/index.ts). The production default is controlled by [`packages/ui/src/themes/config.json`](../../../packages/ui/src/themes/config.json).

| ID | Name | Palette | Identity |
|---|---|---|---|
| `original` | Original | Deep Indigo + Electric Teal | Clean, professional SaaS with a modern tech feel. CauseFlow's production default. |
| `organic-tech` | Organic Tech | Moss + Clay (`#2E4036` / `#CC5833`) | A bridge between a biological research lab and an avant-garde luxury magazine. |
| `midnight-luxe` | Midnight Luxe | Obsidian + Champagne (`#0D0D12` / `#C9A84C`) | A private members' club meets a high-end watchmaker's atelier. |
| `brutalist-signal` | Brutalist Signal | Paper + Signal Red (`#E8E4DD` / `#E63B2E`) | A control room for the future — no decoration, pure information density. |
| `vapor-clinic` | Vapor Clinic | Deep Void + Plasma (`#0A0A14` / `#7B61FF`) | A genome sequencing lab inside a Tokyo nightclub. |

All themes support dark mode (`supportsDarkMode: true`).

## Adding a New Theme

The scaffold lives at [`packages/ui/src/themes/_template/`](../../../packages/ui/src/themes/_template/). Steps:

### 1. Copy the template

```bash
cp -r packages/ui/src/themes/_template packages/ui/src/themes/my-theme
```

### 2. Fill in token values

Rename `tokens/_template.css` to `tokens/light.css` and create `tokens/dark.css`. Fill every HSL triple from `_template.css` — do not leave any undefined or fallback values will bleed through.

```css
[data-theme="my-theme"] {
  --background: 200 50% 98%;
  --foreground: 200 40% 10%;
  --primary: 200 60% 30%;
  /* ... every token from the template ... */
  --radius: 0.5rem;
}

[data-theme="my-theme"].dark {
  --background: 200 50% 6%;
  --foreground: 200 20% 96%;
  /* ... */
}
```

Use `[data-theme="my-theme"]` selectors (not `:root`) so this theme does not override the fallback.

### 3. Register the theme

Edit [`packages/ui/src/themes/index.ts`](../../../packages/ui/src/themes/index.ts):

```ts
const myTheme: ThemeDefinition = {
  id: 'my-theme',
  name: 'My Theme',
  description: 'One-line purpose',
  identity: 'One-line emotional mood',
  supportsDarkMode: true,
  cssFiles: {
    light: 'my-theme/tokens/light.css',
    dark: 'my-theme/tokens/dark.css',
  },
  fonts: { sans: 'Inter', mono: 'JetBrains Mono' },
  palette: {
    primary: '#HEX',
    accent: '#HEX',
    background: '#HEX',
    dark: '#HEX',
  },
};

export const themes: Record<string, ThemeDefinition> = {
  original: originalTheme,
  'my-theme': myTheme,
  /* ... */
};
```

### 4. Import the CSS in `entry.css`

Add both files to [`packages/ui/src/themes/entry.css`](../../../packages/ui/src/themes/entry.css):

```css
@import "./my-theme/tokens/light.css";
@import "./my-theme/tokens/dark.css";
```

### 5. Verify

1. Switch via `DevThemeSwitcher` (dev only) or set `defaultTheme` in `config.json`.
2. Audit every primitive in both modes.
3. Verify 4.5:1 contrast on all text / foreground pairs — see [`accessibility.md`](./accessibility.md).
4. Screenshot both modes into `.artifacts/playwright/screenshots/` and attach to the PR.

## Full Reference

See [`packages/ui/src/themes/THEMES.md`](../../../packages/ui/src/themes/THEMES.md) for the complete folder schema, self-hosted font setup, image organisation, and animation component catalogue.

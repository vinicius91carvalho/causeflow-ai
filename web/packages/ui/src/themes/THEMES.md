## Folder Structure

```
packages/ui/src/themes/
├── index.ts                            # Theme registry + type exports
├── types.ts                            # ThemeDefinition, ThemeId, ColorMode types
├── provider.tsx                        # ThemeProvider context + useTheme hook
├── entry.css                           # Single CSS entry point (import this)
├── original/                           # "Original" theme — the current design
│   ├── tokens/
│   │   ├── light.css                   # :root { } light mode HSL values
│   │   └── dark.css                    # .dark { } dark mode HSL values
│   ├── animations/
│   │   ├── keyframes.css               # @keyframes definitions
│   │   ├── utilities.css               # @utility definitions
│   │   ├── components/                 # React animation components
│   │   │   ├── index.ts
│   │   │   ├── animate-on-scroll.tsx
│   │   │   ├── typing-animation.tsx
│   │   │   └── count-up.tsx
│   │   └── hooks/                      # Animation hooks
│   │       ├── index.ts
│   │       └── use-animate-on-scroll.ts
│   ├── fonts/
│   │   ├── font-stacks.css             # @layer base font-family declarations
│   │   └── files/                      # .woff2 font files (future)
│   └── images/
│       ├── brand/                      # Logos, favicons, OG images
│       ├── illustrations/              # Hero graphics, feature illustrations
│       └── icons/                      # Custom SVG icons
├── shared/
│   └── base.css                        # @theme directive + shared @layer base
└── _template/
    └── tokens/
        └── _template.css               # Commented template for new themes
```

## How CSS Variables Work

The system uses a two-layer approach compatible with Tailwind CSS v4:

### Layer 1: Token Mapping (shared/base.css)

The `@theme` block maps semantic Tailwind color names to CSS custom properties. This is shared across all themes:

```css
@theme {
  --color-primary: hsl(var(--primary));
  --color-accent: hsl(var(--accent));
  /* ... */
}
```

### Layer 2: Token Values (theme-specific)

Each theme defines the actual HSL values for those custom properties:

```css
/* original/tokens/light.css */
:root {
  --primary: 222 47% 11%;    /* Dark Navy */
  --accent: 217 91% 60%;     /* Electric Blue */
}

/* original/tokens/dark.css */
.dark {
  --primary: 217 91% 60%;    /* Electric Blue */
  --accent: 217 91% 60%;     /* Electric Blue lighter */
}
```

### Usage in Components

Tailwind classes use the semantic names automatically:

```tsx
<div className="bg-primary text-primary-foreground">
  <span className="text-accent">Highlighted</span>
</div>
```

## Light/Dark Mode

Each theme can support dark mode via the `.dark` class on `<html>`:

- **Light mode:** `:root` values apply (default)
- **Dark mode:** `.dark` class overrides with dark values
- **System mode:** Follows `prefers-color-scheme` media query

The `ThemeProvider` manages the `.dark` class and `data-theme` attribute.

## Creating a New Theme

1. Copy the template:
   ```bash
   cp -r packages/ui/src/themes/_template packages/ui/src/themes/my-theme
   ```

2. Rename and fill in `tokens/_template.css` → create `light.css` and `dark.css`:
   ```css
   :root {
     --primary: 200 50% 30%;
     --accent: 150 70% 50%;
     /* Fill in all variables from the template */
   }
   ```

3. Register the theme in `index.ts`:
   ```typescript
   const myTheme: ThemeDefinition = {
     id: 'my-theme',
     name: 'My Theme',
     supportsDarkMode: true,
     cssFiles: { light: 'my-theme/tokens/light.css', dark: 'my-theme/tokens/dark.css' },
   };

   export const themes: Record<string, ThemeDefinition> = {
     original: originalTheme,
     'my-theme': myTheme,
   };
   ```

4. Import the CSS in `entry.css`:
   ```css
   /* My Theme (conditionally loaded via data-theme attribute) */
   @import "./my-theme/tokens/light.css";
   @import "./my-theme/tokens/dark.css";
   ```

5. Use `[data-theme="my-theme"]` selectors in your token files instead of `:root` / `.dark`:
   ```css
   [data-theme="my-theme"] {
     --primary: 200 50% 30%;
   }
   [data-theme="my-theme"].dark {
     --primary: 200 50% 70%;
   }
   ```

## Token Reference

| Token | Purpose | Light (Original) | Dark (Original) |
|-------|---------|-------------------|------------------|
| `--background` | Page background | `0 0% 100%` | `222 47% 6%` |
| `--foreground` | Default text | `222 47% 11%` | `210 40% 98%` |
| `--primary` | Primary actions | `222 47% 11%` | `217 91% 60%` |
| `--secondary` | Secondary surfaces | `210 40% 96%` | `217 33% 17%` |
| `--muted` | Muted backgrounds | `210 40% 96%` | `217 33% 17%` |
| `--accent` | Accent highlights | `217 91% 60%` | `217 91% 60%` |
| `--destructive` | Error/danger | `0 84% 60%` | `0 63% 51%` |
| `--success` | Success states | `160 84% 39%` | `160 84% 39%` |
| `--border` | Border color | `214 32% 91%` | `217 33% 17%` |
| `--input` | Input borders | `214 32% 91%` | `217 33% 17%` |
| `--ring` | Focus rings | `217 91% 60%` | `217 91% 60%` |
| `--radius` | Border radius base | `0.625rem` | (inherited) |
| `--chart-1..5` | Chart colors | Various | Various |

## Adding Self-Hosted Fonts

1. Place `.woff2` files in `original/fonts/files/`:
   ```
   original/fonts/files/
   ├── inter-latin-400.woff2
   ├── inter-latin-700.woff2
   └── jetbrains-mono-latin-400.woff2
   ```

2. Add `@font-face` declarations in `font-stacks.css`:
   ```css
   @font-face {
     font-family: "Inter";
     font-style: normal;
     font-weight: 400;
     font-display: swap;
     src: url("./files/inter-latin-400.woff2") format("woff2");
     unicode-range: U+0000-00FF;
   }
   ```

## Image Organization

```
original/images/
├── brand/           # Logo variations, favicons, OG images
│   ├── logo.svg
│   ├── logo-dark.svg
│   ├── favicon.ico
│   └── og-image.png
├── illustrations/   # Marketing illustrations, hero graphics
│   ├── hero.webp
│   └── features.webp
└── icons/           # Custom SVG icons not in lucide-react
    ├── incident.svg
    └── alert.svg
```

## ThemeProvider Usage

The `ThemeProvider` is a skeleton ready for integration in Next.js layouts:

```tsx
// app/layout.tsx
import { ThemeProvider } from '@causeflow/ui/themes/provider';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider defaultColorMode="system">
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Access theme state in components:

```tsx
import { useTheme } from '@causeflow/ui';

function ThemeToggle() {
  const { colorMode, setColorMode } = useTheme();
  return <button onClick={() => setColorMode(colorMode === 'dark' ? 'light' : 'dark')}>Toggle</button>;
}
```

## Animation Components

### AnimateOnScroll

Animates children when they enter the viewport via IntersectionObserver.

```tsx
import { AnimateOnScroll } from '@causeflow/ui';

<AnimateOnScroll variant="fade-up" delay={200} duration={600}>
  <h2>Visible on scroll</h2>
</AnimateOnScroll>
```

**Variants:** `fade-up`, `fade-in`, `fade-left`, `fade-right`, `scale-up`

### TypingAnimation

Reveals lines of text sequentially, simulating a terminal typing effect.

```tsx
import { TypingAnimation } from '@causeflow/ui';

<TypingAnimation lines={['$ deploy --prod', 'Deploying...', 'Done!']} lineDelay={300} />
```

### CountUp

Animates a number from 0 to a target value with easing.

```tsx
import { CountUp } from '@causeflow/ui';

<CountUp end={99} suffix="%" duration={2000} />
```

### useAnimateOnScroll Hook

Low-level hook for custom scroll-triggered animations.

```tsx
import { useAnimateOnScroll } from '@causeflow/ui';

function Custom() {
  const { ref, isVisible } = useAnimateOnScroll({ threshold: 0.2 });
  return <div ref={ref}>{isVisible ? 'Visible!' : 'Hidden'}</div>;
}
```

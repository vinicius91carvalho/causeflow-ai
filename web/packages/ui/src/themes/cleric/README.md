# Cleric Theme

CauseFlow AI — Cleric visual identity. Deep Indigo + Electric Teal color system with Space Grotesk display type.

## Palette

| Token | Light | Dark | Use |
|---|---|---|---|
| `--primary` | `232 50% 18%` (deep indigo) | `172 66% 50%` (electric teal) | CTAs, focus rings |
| `--accent` | `172 66% 30%` (electric teal) | `172 66% 50%` (electric teal) | Highlights, links |
| `--warning` | `23 90% 52%` (amber) | `23 90% 58%` | Attention, alerts |
| `--success` | `160 84% 39%` (emerald) | `160 84% 42%` | Confirmation, status |
| `--background` | `230 18% 95%` (indigo off-white) | `232 35% 6%` (near-black) | Page background |

## Fonts

| Role | Family | Variable |
|---|---|---|
| Sans / body | Plus Jakarta Sans | `--font-jakarta` |
| Display / headings | Space Grotesk | `--font-space-grotesk` |
| Mono / code | JetBrains Mono | `--font-jetbrains-mono` |

Fonts are loaded via `next/font/google` in each app's root layout, which exposes the CSS variables consumed by `fonts/font-stacks.css`. No Google Fonts `@import` is used.

## Token Format

All token values are bare `<h> <s>% <l>%` — no `hsl()` wrapper. This is required by Tailwind CSS v4, which wraps them in `hsl()` when generating utilities like `bg-primary`, `text-accent`, etc.

## File Structure

```
cleric/
├── entry.css          — Imports light + dark tokens + font stacks
├── tokens/
│   ├── light.css      — :root / [data-theme="cleric"] variables
│   └── dark.css       — .dark / [data-theme="cleric"].dark variables
├── fonts/
│   └── font-stacks.css — Font-family declarations consuming --font-* vars
└── README.md
```

## Source Reference

Palette derived from `/root/projects/causeflow/causeflow-new-home.html` design assets.

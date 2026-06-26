# Button

Clickable action trigger with variants, sizes, and optional polymorphic rendering.

## When to use
- Submitting forms
- Triggering commands, navigation, or dialogs
- Any primary or secondary call-to-action

## When NOT to use
- For navigation that should be crawlable or open in a new tab — use an anchor (or pass `asChild` with a `Link`)
- For binary on/off state — use a toggle or checkbox
- For destructive confirmations on their own — pair with `Dialog` to confirm intent

## Props
| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `'default' \| 'destructive' \| 'outline' \| 'secondary' \| 'ghost' \| 'link'` | `'default'` | Visual treatment |
| `size` | `'default' \| 'sm' \| 'lg' \| 'icon'` | `'default'` | Height and padding preset |
| `asChild` | `boolean` | `false` | Render the child element and forward props/styles via Radix `Slot` |
| `className` | `string` | — | Additional classes merged via `cn` |
| ...rest | `ButtonHTMLAttributes<HTMLButtonElement>` | — | All standard button attributes (`disabled`, `onClick`, `type`, etc.) |

Exports `buttonVariants` (CVA) so other components can reuse the style system.

## Variants

| Variant | Use for |
|---|---|
| `default` | Primary action. Subtle glow + scale on hover. |
| `destructive` | Irreversible or dangerous actions |
| `outline` | Secondary action that needs visible affordance |
| `secondary` | Tertiary action, less emphasis than `default` |
| `ghost` | Toolbar / icon actions with low chrome |
| `link` | Inline text-style action |

Sizes: `sm` (h-9), `default` (h-10), `lg` (h-11), `icon` (h-10 square).

## Examples
```tsx
import { Button } from "@causeflow/ui"

<Button>Save changes</Button>
<Button variant="outline" size="sm">Cancel</Button>
<Button variant="destructive">Delete</Button>
<Button size="icon" aria-label="Open menu"><MenuIcon /></Button>

// Polymorphic: render as a Next.js Link
<Button asChild>
  <Link href="/dashboard">Go to dashboard</Link>
</Button>
```

## Accessibility
- Native `<button>` semantics; receives focus, fires on Enter/Space
- Visible focus ring via `focus-visible:ring-2 ring-ring`
- `disabled` sets `pointer-events: none` and 50% opacity — also blocks click handlers
- When using `size="icon"`, you MUST pass `aria-label` so screen readers announce the action
- `asChild` preserves the underlying element's semantics — ensure the child is focusable

## Source
`packages/ui/src/presentation/primitives/button.tsx`

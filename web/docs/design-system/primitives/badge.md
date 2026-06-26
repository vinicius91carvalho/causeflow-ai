# Badge

Small pill-shaped label for statuses, counts, or tags.

## When to use
- Status indicators (e.g. "Active", "Draft", "Failed")
- Counts next to navigation items ("Inbox 3")
- Category or tag chips

## When NOT to use
- For interactive toggles — use `Button` with `variant="outline"`
- For primary calls-to-action — use `Button`
- For long text — Badge is sized for 1-3 short words

## Props
| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `'default' \| 'secondary' \| 'destructive' \| 'outline'` | `'default'` | Visual treatment |
| `className` | `string` | — | Additional classes |
| ...rest | `HTMLAttributes<HTMLDivElement>` | — | All standard div attributes |

Also exports `badgeVariants` (CVA).

## Variants

| Variant | Use for |
|---|---|
| `default` | Neutral/primary status |
| `secondary` | De-emphasized status |
| `destructive` | Errors, failures, blocked states |
| `outline` | Low-chrome tag, transparent background |

## Examples
```tsx
import { Badge } from "@causeflow/ui"

<Badge>New</Badge>
<Badge variant="secondary">Draft</Badge>
<Badge variant="destructive">Failed</Badge>
<Badge variant="outline">beta</Badge>
```

## Accessibility
- Renders a plain `<div>` — NOT focusable by default
- If the badge conveys state that is not in surrounding text, add `aria-label` describing it
- Does not receive focus or handle keyboard events — not an interactive primitive

## Source
`packages/ui/src/presentation/primitives/badge.tsx`

# Card

Surface container that groups related content with a consistent border, background, and padding system.

## When to use
- Grouping related information (metrics, settings panels, summaries)
- Bordered list items where each row is richer than a single line
- Marketing feature blocks and dashboard tiles

## When NOT to use
- For purely decorative wrappers — use a plain div
- For modal content — use `Dialog`
- For page-level containers — cards are meant to compose within a page

## Parts
| Part | Element | Styling |
|---|---|---|
| `Card` | `<div>` | Rounded border, `bg-card`, shadow-sm, transition |
| `CardHeader` | `<div>` | `flex flex-col space-y-1.5 p-6` |
| `CardTitle` | `<div>` | `text-2xl font-semibold` |
| `CardDescription` | `<div>` | `text-sm text-muted-foreground` |
| `CardContent` | `<div>` | `p-6 pt-0` |
| `CardFooter` | `<div>` | `flex items-center p-6 pt-0` |

Every part accepts all standard `HTMLAttributes<HTMLDivElement>` plus `className`.

## Examples
```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@causeflow/ui"

<Card>
  <CardHeader>
    <CardTitle>API Usage</CardTitle>
    <CardDescription>Past 30 days</CardDescription>
  </CardHeader>
  <CardContent>
    <p>12,304 requests</p>
  </CardContent>
  <CardFooter>
    <Button variant="outline">View details</Button>
  </CardFooter>
</Card>
```

## Accessibility
- Card parts render plain `<div>` elements — no implicit landmark
- If a card acts as a link target, wrap it with a focusable element and provide an accessible name
- Use `CardTitle` as the heading-like label but render as appropriate (e.g., wrap in `<h2>` via `asChild` pattern if semantic heading is needed — not built in; add your own)
- Maintain a logical reading order: Header, Content, Footer

## Source
`packages/ui/src/presentation/primitives/card.tsx`

# Accordion

Vertically stacked set of interactive headings that each reveal a section of content. Wraps [Radix Accordion](https://www.radix-ui.com/primitives/docs/components/accordion).

## When to use
- FAQs
- Progressive disclosure of secondary content in settings or onboarding
- Long-form content where collapsing sections reduces scroll

## When NOT to use
- When users need to compare items side-by-side — use `Tabs`
- For navigation between routes — use `NavigationMenu`
- For a single collapsible region — a plain `<details>` element is lighter

## Parts
| Part | Description |
|---|---|
| `Accordion` | Root. Radix `Root`. Accepts `type="single" \| "multiple"`, `collapsible`, `value`, `defaultValue`, `onValueChange`. |
| `AccordionItem` | A single collapsible region. Requires a unique `value`. Adds bottom border. |
| `AccordionTrigger` | The clickable heading. Wrapped in a Radix `Header`. Chevron rotates on open. |
| `AccordionContent` | The revealed panel. Animates via `accordion-up` / `accordion-down`. |

All props for each part pass through to the corresponding Radix primitive.

## Examples
```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@causeflow/ui"

<Accordion type="single" collapsible>
  <AccordionItem value="billing">
    <AccordionTrigger>How does billing work?</AccordionTrigger>
    <AccordionContent>We bill monthly, cancel anytime.</AccordionContent>
  </AccordionItem>
  <AccordionItem value="support">
    <AccordionTrigger>Is support included?</AccordionTrigger>
    <AccordionContent>Yes, on all plans.</AccordionContent>
  </AccordionItem>
</Accordion>
```

## Accessibility
- Arrow Up/Down, Home, End move focus between triggers (Radix default)
- Enter/Space toggle the focused item
- `aria-expanded` and `aria-controls` wired automatically by Radix
- Trigger is a real `<button>` inside a heading for correct landmark semantics
- Honors `prefers-reduced-motion` via the `accordion-up/down` animations

## Source
`packages/ui/src/presentation/primitives/accordion.tsx`

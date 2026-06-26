# Label

Accessible form label. Wraps [Radix Label](https://www.radix-ui.com/primitives/docs/components/label) so clicks and drags forward focus to the associated control.

## When to use
- Any form field (`Input`, `Select`, `Slider`, textarea, checkbox, radio)
- Whenever a control needs a visible caption

## When NOT to use
- As a generic text element — use a span or p tag
- As a heading — use an `<h*>`

## Props
| Prop | Type | Default | Description |
|---|---|---|---|
| `htmlFor` | `string` | — | ID of the associated form control. Required for linkage. |
| `className` | `string` | — | Additional classes |
| ...rest | `ComponentPropsWithoutRef<typeof LabelPrimitive.Root>` | — | Standard label attributes |

Base styling: `text-sm font-medium leading-none`. Also dims to 70% opacity and shows `cursor-not-allowed` when a sibling with `peer` class is `:disabled`.

## Examples
```tsx
import { Label } from "@causeflow/ui"
import { Input } from "@causeflow/ui"

<div className="grid gap-2">
  <Label htmlFor="name">Name</Label>
  <Input id="name" className="peer" />
</div>
```

## Accessibility
- Clicking the label focuses the associated control (Radix)
- Use `htmlFor` that matches the control's `id`
- For controls built from composite primitives (`Select`, `Slider`), pass `aria-labelledby` pointing to the label element

## Source
`packages/ui/src/presentation/primitives/label.tsx`

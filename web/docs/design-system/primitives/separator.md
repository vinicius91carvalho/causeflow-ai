# Separator

Thin horizontal or vertical rule for visually separating content. Wraps [Radix Separator](https://www.radix-ui.com/primitives/docs/components/separator).

## When to use
- Dividing groups within a menu, form, or list
- Visually splitting sections within a card

## When NOT to use
- As the primary structure of a page — use layout spacing instead
- When a heading would be clearer — use a heading

## Props
| Prop | Type | Default | Description |
|---|---|---|---|
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Axis of the separator |
| `decorative` | `boolean` | `true` | When `true` the element is hidden from assistive tech. Set `false` to expose as a semantic separator. |
| `className` | `string` | — | Additional classes |
| ...rest | `ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>` | — | Standard Radix separator props |

Horizontal renders as `h-[1px] w-full`; vertical as `h-full w-[1px]`. Background `bg-border`.

## Examples
```tsx
import { Separator } from "@causeflow/ui"

<div>
  <h3>Account</h3>
  <Separator className="my-4" />
  <form>...</form>
</div>

<div className="flex h-5 items-center gap-4">
  <span>Docs</span>
  <Separator orientation="vertical" />
  <span>API</span>
</div>
```

## Accessibility
- When `decorative` is `false`, rendered with `role="separator"` and appropriate `aria-orientation`
- Default (`decorative={true}`) hides from AT — use this for purely visual dividers

## Source
`packages/ui/src/presentation/primitives/separator.tsx`

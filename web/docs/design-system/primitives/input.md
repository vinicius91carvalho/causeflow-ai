# Input

Styled single-line text input. Thin wrapper over the native `<input>`.

## When to use
- Short single-line user input (text, email, password, number, search)
- File pickers (`type="file"`) — styled via the `::file` pseudo-element

## When NOT to use
- For multi-line input — use a textarea
- For toggles, selects, or date pickers — use the respective primitive (`Select`, etc.)
- For searchable lists with options — combine with a menu primitive

## Props
| Prop | Type | Default | Description |
|---|---|---|---|
| `type` | `string` | `'text'` | Native input type (`text`, `email`, `password`, `file`, `number`, ...) |
| `className` | `string` | — | Additional classes |
| ...rest | `InputHTMLAttributes<HTMLInputElement>` | — | All native input props (`value`, `onChange`, `placeholder`, `disabled`, `required`, `name`, etc.) |

No variants. Height `h-10`, full width, rounded, focus ring, WebKit autofill override so autofilled values match theme.

## Examples
```tsx
import { Input } from "@causeflow/ui"
import { Label } from "@causeflow/ui"

<div className="grid gap-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="you@company.com" required />
</div>

<Input type="file" accept="image/*" />
```

## Accessibility
- Always associate with a `Label` via `htmlFor`/`id` — the input itself is unlabeled
- For validation errors, pair with `aria-invalid` and `aria-describedby` pointing to a helper message
- `disabled` state reduces opacity to 50% and blocks pointer events
- Focus ring appears on `focus-visible` (keyboard-only)

## Source
`packages/ui/src/presentation/primitives/input.tsx`

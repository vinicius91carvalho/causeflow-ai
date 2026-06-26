# Select

Accessible single-value dropdown list. Wraps [Radix Select](https://www.radix-ui.com/primitives/docs/components/select).

## When to use
- Picking a single value from a known set (5-50 options)
- Form fields where a native `<select>` would be acceptable but themed UI is required

## When NOT to use
- For very long lists — use a combobox/autocomplete (not in this library yet)
- For 2-4 options — consider radio buttons or a toggle group
- For multi-select — use multiple checkboxes or a dedicated multi-select primitive

## Parts
| Part | Description |
|---|---|
| `Select` | Root. Props: `value`, `defaultValue`, `onValueChange`, `disabled`, `name`, `required`. |
| `SelectTrigger` | The button. Includes a chevron icon. |
| `SelectValue` | Renders the currently selected label (or a `placeholder` if none). |
| `SelectContent` | Portaled dropdown panel. Supports `position="popper" \| "item-aligned"` (default `popper`), `side`, `align`, `sideOffset`. |
| `SelectGroup` | Groups items under a `SelectLabel`. |
| `SelectLabel` | Non-selectable label for a group. |
| `SelectItem` | A single option. Requires a `value` prop. Shows a check when selected. |
| `SelectSeparator` | Visual divider between groups. |
| `SelectScrollUpButton` / `SelectScrollDownButton` | Auto-rendered inside `SelectContent` for long lists. |

## Examples
```tsx
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@causeflow/ui"

<Select defaultValue="us">
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Select a region" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Americas</SelectLabel>
      <SelectItem value="us">United States</SelectItem>
      <SelectItem value="br">Brazil</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

## Accessibility
- Full keyboard support via Radix: Space/Enter to open, Arrow keys to navigate, type-ahead, Home/End
- Focus returns to the trigger on close
- Label the trigger with a `<Label htmlFor>` plus matching `id`, or with `aria-label`
- Disabled items use `data-[disabled]` and are skipped by keyboard navigation

## Source
`packages/ui/src/presentation/primitives/select.tsx`

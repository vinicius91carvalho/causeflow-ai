# Slider

Range input with a single thumb. Wraps [Radix Slider](https://www.radix-ui.com/primitives/docs/components/slider).

## When to use
- Adjusting a numeric value with continuous feedback (volume, thresholds, timeline scrub)
- Use cases where approximate value matters more than precise entry

## When NOT to use
- For precise numeric input — use `Input type="number"`
- For discrete choices over a small set — use a `Select` or radio group
- For multi-thumb ranges — the wrapper renders a single thumb; use Radix directly if multi-thumb is required

## Props
Forwards all Radix `Slider.Root` props. Common ones:

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `number[]` | — | Controlled value (array to support ranges; the wrapper renders a single thumb). |
| `defaultValue` | `number[]` | — | Uncontrolled initial value |
| `onValueChange` | `(value: number[]) => void` | — | Fires on change |
| `onValueCommit` | `(value: number[]) => void` | — | Fires when the user stops interacting |
| `min` | `number` | `0` | Minimum |
| `max` | `number` | `100` | Maximum |
| `step` | `number` | `1` | Granularity |
| `disabled` | `boolean` | `false` | Disabled state |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Axis |
| `dir` | `'ltr' \| 'rtl'` | inherited | Direction |
| `aria-label` | `string` | — | Accessible name for the thumb (recommended) |
| `className` | `string` | — | Additional classes on the root |

The wrapper renders one `Track`, one `Range`, and one `Thumb`. Pass `aria-label` to name the thumb.

## Examples
```tsx
import { Slider } from "@causeflow/ui"

<Slider
  defaultValue={[50]}
  min={0}
  max={100}
  step={1}
  aria-label="Volume"
/>
```

## Accessibility
- Arrow Left/Right (or Down/Up) step by `step`; Shift+Arrow jumps by a larger amount; Home/End go to min/max
- `aria-label` or `aria-labelledby` is REQUIRED to describe the control — this wrapper forwards `aria-label` to both root and thumb
- Disabled state prevents pointer and keyboard interaction

## Source
`packages/ui/src/presentation/primitives/slider.tsx`

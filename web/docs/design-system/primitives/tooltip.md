# Tooltip

Small hover/focus popup that describes an element. Wraps [Radix Tooltip](https://www.radix-ui.com/primitives/docs/components/tooltip).

> Note: `tooltip.tsx` exists in the primitives folder but is NOT currently re-exported from `packages/ui/src/presentation/primitives/index.ts`. To use it, import directly from the source or add the re-export.

## When to use
- Describing icon-only buttons and compact controls
- Short (1-line) clarifications of already-visible labels

## When NOT to use
- For essential information — tooltips are hidden by default and unreliable on touch devices
- For rich interactive content — use `Popover` (not in this library yet) or `Dialog`
- For long form help — use inline text or a help link

## Parts
| Part | Description |
|---|---|
| `TooltipProvider` | MUST wrap the app (or subtree) that uses tooltips. Props: `delayDuration`, `skipDelayDuration`, `disableHoverableContent`. |
| `Tooltip` | Root. Props: `open`, `defaultOpen`, `onOpenChange`, `delayDuration`. |
| `TooltipTrigger` | The element that shows the tooltip on hover/focus. Use `asChild` to wrap a custom element. |
| `TooltipContent` | The popup. Props: `side`, `align`, `sideOffset` (default `4`), `avoidCollisions`. |

## Examples
```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@causeflow/ui/src/presentation/primitives/tooltip" // not yet in barrel

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button size="icon" aria-label="Refresh"><RefreshIcon /></Button>
    </TooltipTrigger>
    <TooltipContent>Refresh data</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

## Accessibility
- Shows on hover AND keyboard focus (Radix); dismisses on blur/Escape
- Content is wired via `aria-describedby` on the trigger — the trigger must remain labelled
- Do NOT rely on tooltips for information a user needs to complete a task
- For touch users, pair the affordance with a visible label whenever possible

## Source
`packages/ui/src/presentation/primitives/tooltip.tsx`

# Sheet

Slide-in panel (drawer) anchored to an edge of the viewport. Built on [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) with directional variants.

## When to use
- Mobile navigation drawers
- Side panels for settings, filters, or detail views that complement the main content
- Any overlay where a full-screen `Dialog` is too heavy

## When NOT to use
- For short confirmations — use `Dialog`
- For popovers over a small trigger — use a tooltip or dropdown
- For persistent sidebars — use layout components, not a Sheet

## Parts
| Part | Description |
|---|---|
| `Sheet` | Root (alias of Radix Dialog Root). `open`, `defaultOpen`, `onOpenChange`, `modal`. |
| `SheetTrigger` | Opens the sheet. |
| `SheetPortal` | Portals to body (used by `SheetContent`). |
| `SheetOverlay` | Dimmed backdrop. |
| `SheetContent` | The panel. Accepts `side="top" \| "bottom" \| "left" \| "right"` (default `right`). Includes built-in close (X). |
| `SheetHeader` | Title + description container. |
| `SheetTitle` | Required for accessibility. |
| `SheetDescription` | Optional supporting text. |
| `SheetFooter` | Action row. Flex column on mobile, end-aligned row on `sm`. |
| `SheetClose` | Close button (any `asChild`). |

## Variants (SheetContent `side`)

| Side | Width/Height |
|---|---|
| `right` (default) | Full height, `w-3/4` capped at `sm:max-w-sm`. Slides from right. |
| `left` | Full height, `w-3/4` capped at `sm:max-w-sm`. Slides from left. |
| `top` | Full width. Slides from top. |
| `bottom` | Full width. Slides from bottom. |

## Examples
```tsx
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@causeflow/ui"

<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline">Open filters</Button>
  </SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Filters</SheetTitle>
      <SheetDescription>Refine the results</SheetDescription>
    </SheetHeader>
    {/* filter controls */}
    <SheetFooter>
      <SheetClose asChild><Button>Apply</Button></SheetClose>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

## Accessibility
- Focus trapped inside `SheetContent` while open
- Escape closes; click outside closes (unless `modal={false}`)
- `SheetTitle` MUST be rendered — Radix warns in dev if missing. Use `VisuallyHidden` if no visible title.
- Close button has `sr-only` "Close" label
- Animations honor `prefers-reduced-motion` via Tailwind utilities

## Source
`packages/ui/src/presentation/primitives/sheet.tsx`

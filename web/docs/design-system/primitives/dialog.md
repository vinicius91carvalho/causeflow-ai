# Dialog

Modal overlay for focused tasks and confirmations. Wraps [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog). Includes a built-in close button in `DialogContent`.

## When to use
- Short, focused flows that require user attention (create/edit forms, confirmations)
- Tasks that must complete before the user returns to the page
- Any overlay that should trap focus and dismiss on Escape

## When NOT to use
- For non-blocking messages — use a toast
- For multi-step workflows that need a full page — use a route
- For side-sheet / drawer interactions — use `Sheet`

## Parts
| Part | Description |
|---|---|
| `Dialog` | Root state container. Props: `open`, `defaultOpen`, `onOpenChange`, `modal`. |
| `DialogTrigger` | Opens the dialog. Pair with `asChild` to use a custom trigger. |
| `DialogPortal` | Portals the overlay and content to document body (used internally by `DialogContent`). |
| `DialogOverlay` | Dimmed backdrop, `bg-black/80` with fade animation. |
| `DialogContent` | The panel. Renders overlay and a close (X) button. Centered, max-w-lg, animated. |
| `DialogHeader` | Flex column for title + description. Centered on mobile, left on `sm`. |
| `DialogTitle` | Required for accessibility. Renders as Radix `Title`. |
| `DialogDescription` | Optional supporting text. |
| `DialogFooter` | Action row. Flex column on mobile, end-aligned row on `sm`. |
| `DialogClose` | Wraps any button to close the dialog imperatively. |

All parts forward their Radix props.

## Examples
```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@causeflow/ui"

<Dialog>
  <DialogTrigger asChild>
    <Button>Invite teammate</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Invite teammate</DialogTitle>
      <DialogDescription>They will receive an email invitation.</DialogDescription>
    </DialogHeader>
    <Input placeholder="teammate@company.com" />
    <DialogFooter>
      <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
      <Button>Send invite</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Accessibility
- Focus is trapped inside `DialogContent` while open
- Escape closes the dialog; click outside closes it (unless `modal={false}`)
- `DialogTitle` MUST be rendered — Radix will warn in dev if missing. Use `VisuallyHidden` if a visible title is not desired.
- `DialogDescription` is wired via `aria-describedby` automatically when present
- Close button has `sr-only` "Close" label

## Source
`packages/ui/src/presentation/primitives/dialog.tsx`

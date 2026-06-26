# Primitives

Low-level building blocks exposed by `@causeflow/ui`. Most wrap [Radix UI](https://www.radix-ui.com/primitives) with project-specific styling via Tailwind and `class-variance-authority`.

All components live under `packages/ui/src/presentation/primitives/` and are re-exported from `packages/ui/src/presentation/primitives/index.ts` (which is itself re-exported from `packages/ui/src/index.ts`).

## Catalog

| Primitive | One-liner | Wraps Radix | Doc |
|---|---|---|---|
| Accordion | Vertically stacked collapsible sections | yes | [accordion.md](./accordion.md) |
| Badge | Small pill for statuses, counts, tags | no | [badge.md](./badge.md) |
| Button | Clickable action with variants and sizes | no (uses `@radix-ui/react-slot` for `asChild`) | [button.md](./button.md) |
| Card | Surface container for grouped content | no | [card.md](./card.md) |
| Dialog | Modal overlay for focused tasks | yes | [dialog.md](./dialog.md) |
| Input | Themed single-line text input | no | [input.md](./input.md) |
| Label | Accessible form label | yes | [label.md](./label.md) |
| NavigationMenu | Horizontal site-level menu with dropdowns | yes | [navigation-menu.md](./navigation-menu.md) |
| Select | Accessible single-value dropdown | yes | [select.md](./select.md) |
| Separator | Horizontal or vertical rule | yes | [separator.md](./separator.md) |
| Sheet | Slide-in panel anchored to an edge | yes (Dialog) | [sheet.md](./sheet.md) |
| Slider | Numeric range input with a single thumb | yes | [slider.md](./slider.md) |
| Table | Styled wrappers around native table elements | no | [table.md](./table.md) |
| Tabs | Switch between mutually exclusive panels | yes | [tabs.md](./tabs.md) |
| Tooltip | Hover/focus popup describing an element | yes | [tooltip.md](./tooltip.md) |

## Notes

- **Import path:** `import { Button } from "@causeflow/ui"`. Do not reach into deep paths unless documented (see Tooltip note below).
- **Tooltip is not in the barrel:** `tooltip.tsx` exists in the primitives folder but is not re-exported from the primitives index. See [tooltip.md](./tooltip.md).
- **Polymorphism:** Most Radix-backed parts support `asChild` to forward styles to a custom element (e.g., `<Button asChild><Link href="/">Home</Link></Button>`).
- **Styling:** All primitives merge classes via the `cn` helper (`packages/ui/src/lib/utils.ts`). Pass `className` to override.
- **Variants:** Components using CVA export their variants alongside (`buttonVariants`, `badgeVariants`, `navigationMenuTriggerStyle`).

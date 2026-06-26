# NavigationMenu

Horizontal menu with optional dropdown viewports for top-level site navigation. Wraps [Radix NavigationMenu](https://www.radix-ui.com/primitives/docs/components/navigation-menu).

## When to use
- Marketing site or app header navigation with hover-expandable sections
- Top-level product navigation with rich mega-menu content

## When NOT to use
- For in-page tab switching — use `Tabs`
- For dense, command-style menus — use a dropdown menu primitive
- For mobile/drawer navigation — use `Sheet` with a list of links

## Parts
| Part | Description |
|---|---|
| `NavigationMenu` | Root. Renders a Radix `Root` and includes the `NavigationMenuViewport` automatically. |
| `NavigationMenuList` | The horizontal list of items. |
| `NavigationMenuItem` | One item within the list (re-export of Radix `Item`). |
| `NavigationMenuTrigger` | Button that opens a section. Shows a rotating chevron when open. |
| `NavigationMenuContent` | The dropdown panel that slides in/out. |
| `NavigationMenuLink` | A single link inside the list or within content (re-export of Radix `Link`). |
| `NavigationMenuIndicator` | Small arrow pointing at the active trigger. Optional. |
| `NavigationMenuViewport` | Container for animated content. Rendered automatically by `NavigationMenu`. |
| `navigationMenuTriggerStyle` | CVA export for styling other elements to match the trigger (e.g., non-dropdown links). |

Props forward to the corresponding Radix primitives.

## Examples
```tsx
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@causeflow/ui"
import Link from "next/link"

<NavigationMenu>
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuTrigger>Product</NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul className="grid w-[400px] gap-3 p-4">
          <NavigationMenuLink asChild>
            <Link href="/product">Overview</Link>
          </NavigationMenuLink>
          <NavigationMenuLink asChild>
            <Link href="/integrations">Integrations</Link>
          </NavigationMenuLink>
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
    <NavigationMenuItem>
      <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
        <Link href="/pricing">Pricing</Link>
      </NavigationMenuLink>
    </NavigationMenuItem>
  </NavigationMenuList>
</NavigationMenu>
```

## Accessibility
- Arrow keys move focus between triggers; Enter/Space opens a content panel
- Escape closes the open panel and returns focus to the trigger
- Triggers use `aria-expanded` and are wired to their content via Radix
- Keep the trigger's text descriptive — dropdown content is not announced on focus

## Source
`packages/ui/src/presentation/primitives/navigation-menu.tsx`

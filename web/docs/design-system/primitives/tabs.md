# Tabs

Switch between mutually exclusive panels. Wraps [Radix Tabs](https://www.radix-ui.com/primitives/docs/components/tabs).

## When to use
- Switching between views of the same entity (e.g., Overview / Activity / Settings)
- Inline filtering between a small, fixed set of views (2-6 tabs)

## When NOT to use
- For navigating to different routes — use `NavigationMenu` or links
- For progressive disclosure of related content in the same view — use `Accordion`
- For more than ~6 options — consider a select or sidebar

## Parts
| Part | Description |
|---|---|
| `Tabs` | Root. Props: `value`, `defaultValue`, `onValueChange`, `orientation`, `dir`, `activationMode`. |
| `TabsList` | The row of triggers. Styled as a pill container with muted background. |
| `TabsTrigger` | A single tab button. Requires a `value`. Active state: accent background, white text, slight scale. |
| `TabsContent` | The panel associated with a trigger. Requires matching `value`. |

All parts forward their Radix props.

## Examples
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@causeflow/ui"

<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="activity">Activity</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">Key metrics</TabsContent>
  <TabsContent value="activity">Event log</TabsContent>
  <TabsContent value="settings">Configuration</TabsContent>
</Tabs>
```

## Accessibility
- Arrow keys move focus between triggers (Radix)
- Home/End jump to the first/last trigger
- Triggers expose `role="tab"` with `aria-selected`; panels expose `role="tabpanel"`
- `activationMode="manual"` delays activation until Enter/Space for cases where switching is expensive
- Keep trigger labels short — long labels break the pill layout

## Source
`packages/ui/src/presentation/primitives/tabs.tsx`

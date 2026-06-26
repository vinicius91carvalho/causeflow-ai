---
title: Shadcn TabsList needs h-auto when tabs wrap on mobile
date: 2026-02-28
category: bugfixes
tags: [shadcn, tabs, tailwind, mobile, flex-wrap, h-auto, overflow, css]
app: website
severity: low
---

# Shadcn TabsList needs h-auto when tabs wrap on mobile

## Problem

On mobile viewports, tabs inside a Shadcn `TabsList` wrap to multiple lines (via `flex-wrap`). The tabs visually overflow beyond their declared height. Any sibling element with `space-y-*` spacing measures against the declared 40px box height, causing the next element to overlap the wrapped tabs.

## Root Cause

Shadcn's `TabsList` component has a hardcoded `h-10` (40px) class. When `flex-wrap` causes items to flow onto a second row, the visual height exceeds 40px but the layout box remains at 40px, breaking sibling spacing.

## Solution

Add `h-auto` to the `TabsList` className to override the fixed height:

```tsx
// Integrations page — apps/website/src/components/sections/integrations-*.tsx
<TabsList className="flex flex-wrap h-auto gap-2">
  <TabsTrigger value="all">All</TabsTrigger>
  <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
  {/* ... */}
</TabsList>
```

`h-auto` lets the container grow to fit its wrapped content, restoring correct sibling spacing.

## Prevention

- **Rule:** When using `flex-wrap` on any fixed-height container, always override the fixed height with `h-auto`.
- This applies to any Shadcn component that ships with a fixed `h-*` class: `TabsList`, `NavigationMenuList`, etc.
- Mobile-first review checklist: check all `flex flex-wrap` usages for height overflow.

## Related

- [Shadcn Tabs docs](https://ui.shadcn.com/docs/components/tabs)
- Mobile-first responsive pattern: [`patterns/2026-02-28_env-local-standard.md`](../patterns/)

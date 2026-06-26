# Cards

A card is a rounded, bordered container that groups a piece of content. CauseFlow has three distinct card dialects — each solves a different problem and pulls from a different part of the stack. Pick the right one.

## Tiers

| Tier | Base | Use when | Example |
|---|---|---|---|
| **Primitive card** | `Card` / `CardHeader` / `CardContent` / `CardFooter` from `@causeflow/ui/primitives` | You want the design-system-default visual: border, radius, padding, hover affordance | `FeatureCard`, `PricingCard` |
| **Feature card** | Raw `<div>` or `<section>` with Tailwind utilities | Card is tightly coupled to a bounded context — domain-specific styling, conditional tone by domain state, non-standard padding | `RootCauseCard`, `HypothesisDebateView`'s `WinnerCard` |
| **Interactive card** | `<Link>` or `<button>` wrapping card markup | The entire card is the affordance — no inner button | `StepCard` on welcome page, integration grid cards |

## 1. Primitive Card (marketing default)

The `Card` primitive (shadcn-style) from `@causeflow/ui/primitives` is the default for any marketing-surface card. It composes with `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.

```tsx
// apps/website/src/contexts/marketing/presentation/components/sections/feature-card.tsx
<Card className={cn('group h-full hover:-translate-y-1 hover:bg-accent hover:border-accent hover:shadow-lg hover:shadow-accent/20', className)}>
  <CardHeader>
    {icon && <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary ...">{icon}</div>}
    <CardTitle className="text-lg ...">{title}</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground ...">{description}</p>
  </CardContent>
</Card>
```

Hover pattern: `group` on the root + `group-hover:*` on inner elements so icon, title, and description all transition in lock-step. Used consistently across `FeatureCard`, `PricingCard`, and `MetricCard`.

### Pricing card — a richer composition

`apps/website/src/contexts/marketing/presentation/components/sections/pricing-card.tsx` uses the full primitive stack plus two state props:

- `highlighted` — emerald-filled treatment for the "popular" plan (`pricing-card.tsx:51-52`)
- `selected` — `ring-2 ring-primary border-primary` for interactive selection (`pricing-card.tsx:53`)

It renders name, price, description, feature list (`<ul>` with inline checkmark SVGs), and a footer CTA. When highlighted, every text / border color flips via conditional classes. The CTA button's `stopPropagation` prevents the card-level `onClick` from double-firing (`pricing-card.tsx:140-143`).

## 2. Data Card (dashboard feature)

Dashboard data cards are generally NOT built on the `Card` primitive. Instead they use raw Tailwind so domain state can drive the visual tone.

### Root cause card — tone by status

`apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/root-cause-card.tsx` picks its border and background from the incident's status:

```tsx
const cardClasses = isResolved
  ? 'border-green-300 bg-green-50/60 dark:border-green-800 dark:bg-green-950/30'
  : 'border-purple-300 bg-purple-50/60 dark:border-purple-800 dark:bg-purple-950/30';

return <section className={`rounded-xl border p-5 shadow-sm ${cardClasses}`}>...</section>;
```

The inner structure still mirrors the primitive (pill badge → title → body → optional Show more toggle) but every token is resolved inline so the card can express "resolved vs active" at a glance.

### Hypothesis winner card — heavy semantic coloring

`HypothesisDebateView`'s `WinnerCard` (`hypothesis-debate-view.tsx:135-173`) uses green fills + icon badges to signal "confirmed hypothesis". It composes several sub-components inside: `ScoreBadge`, `ConfidenceBar`, `InformedBy`, `EvidenceLists` — the card itself is just the frame.

### Rule for data cards

- Use `rounded-xl border bg-card shadow-sm` as the neutral base.
- Switch to tinted border + bg variants (`border-green-300 bg-green-50/60` etc.) only when domain state justifies it.
- Dark-mode variant must be declared on the same element (`dark:border-green-800 dark:bg-green-950/30`).
- Keep padding `p-4` (compact) or `p-5` (standard). Avoid `p-6` in dashboard data cards — density matters inside a viewport-bound shell.

## 3. Interactive Card (entire card is the affordance)

When the whole card should click, wrap card markup in `<Link>` or `<button>`. Do NOT place an inner button AND make the outer card clickable — that creates nested interactive elements.

```tsx
// apps/dashboard/src/contexts/identity/presentation/pages/welcome-page.tsx:21-53 (StepCard)
<Link
  href={href}
  className={cn(
    'group flex items-start gap-4 rounded-xl border border-border bg-card p-4 shadow-sm',
    'hover:border-primary/30 hover:shadow-md transition-all',
    completed && 'opacity-60',
  )}
>
  {/* icon + text + trailing ArrowRight */}
</Link>
```

Integration cards in the onboarding grid (`onboarding-integrations-grid.tsx:234-286`) break the rule: the card is a `<div>` and the Connect button is the only click target. That's deliberate because the click action depends on auth type (OAuth popup vs ConnectionModal). If the whole card were a link, the button state ("Connected") would be misleading.

## Decision Matrix

| You want to... | Use |
|---|---|
| Show a marketing feature tile that navigates to a section | `FeatureCard` (primitive) |
| Render a pricing tier with highlight + CTA | `PricingCard` (primitive, specialized) |
| Render a stat + label + source | `MetricCard` (primitive, specialized) |
| Render an incident's root cause with tone changing by status | Raw Tailwind data card (domain owns the tone) |
| Offer a multi-option choice where each option has an icon + desc + arrow | Interactive `<Link>` card (like welcome `StepCard`) |
| Represent a connected third-party integration with Connect/Authorize/Connected button | Raw Tailwind card; button owns the click |

## Anti-patterns

- Do not copy the `Card` primitive's HSL border color into a raw Tailwind card. The primitive uses `border` + `bg-card` tokens; raw cards should also use semantic tokens (`border-border bg-card`) unless they express state-specific tone.
- Do not stack `shadow-sm shadow-md` on the same card — use one shadow and let hover swap it (`hover:shadow-lg`).
- Do not animate `height` on hover — it causes layout shift. Use `translate-y` or `scale` (`hover:-translate-y-1`).
- Do not put a `<Link>` or `<button>` inside a clickable card wrapper — nested interactive elements break keyboard navigation.

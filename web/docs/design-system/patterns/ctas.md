# Call-to-Action (CTA) Patterns

A CTA is a user-visible prompt to take an action: sign up, start an investigation, connect an integration, upgrade a plan. CauseFlow uses a strict hierarchy so users can always identify the primary action at a glance.

## Button Hierarchy

Mapped onto the `Button` primitive's variants (`packages/ui/src/presentation/primitives/button.tsx`):

| Role | Variant | Visual | Use for |
|---|---|---|---|
| Primary | `default` | Filled primary color | Most-important action on the surface — submit, continue, create |
| Secondary | `outline` | Bordered, transparent fill | Alternative path — "Learn more", "Cancel and go back" |
| Tertiary | `secondary` | Subtle filled grey | De-emphasized action that still needs a button |
| Destructive | `destructive` | Filled destructive color | Irreversible actions — delete, abort |
| Ghost | `ghost` | No border, no fill | Toolbar / icon-button actions |
| Link | `link` | Inline text | Navigation that reads like prose |

**Rule of one per zone.** In any given visual region (hero, form footer, dialog footer, action bar), there is **exactly one** `default` button. Additional actions use `outline`, `secondary`, `ghost`, or `link`.

## Hero CTA (marketing)

The marketing hero uses a primary + secondary pair. Both are `size="lg"` so they meet a 44×44 tap target on mobile. On mobile they stack; at `sm+` they sit side-by-side.

```tsx
// apps/website/src/contexts/marketing/presentation/components/sections/hero-section.tsx:75-97
<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
  <Link href={primaryCta.href}>
    <Button size="lg" className="w-full sm:w-auto">{primaryCta.label}</Button>
  </Link>
  {secondaryCta && (
    <Link href={secondaryCta.href}>
      <Button variant="outline" size="lg" className="w-full sm:w-auto">
        {secondaryCta.label}
      </Button>
    </Link>
  )}
</div>
```

`w-full sm:w-auto` is load-bearing — it gives mobile CTAs full-width tap targets while letting them shrink on wider viewports.

### Final / mid-page CTA

`CTASection` (`apps/website/src/contexts/marketing/presentation/components/sections/cta-section.tsx`) applies the same primary + secondary pattern inside a centered band with the glow treatment. Home page renders this at the bottom via `ContactCTASection` (`home-page.tsx:521-529`).

## Inline CTA (dashboard action bar)

`IncidentActionBar` (`apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/incident-action-bar.tsx`) is the canonical in-app CTA cluster. The hierarchy is encoded directly in Tailwind classes because the existing action bar predates a full primitive migration:

- Status `open` → "Start Triage" (secondary-styled blue) + "Start Investigation" (primary — `bg-primary text-primary-foreground hover:bg-primary/90`) + optional staff-only mode selector.
- Status `investigating` → "Abort" (destructive-styled red) with inline confirm panel (two sub-buttons: red primary "Yes" + outline "Cancel").
- Status `resolved` / `closed` → "+ Rerun" (outline, ghost-ish).

Key rules visible in the code:

- Only one filled `bg-primary` button per cluster (`incident-action-bar.tsx:76`).
- Disabled state: `disabled:opacity-60 disabled:cursor-not-allowed` — consistent across every button in the action bar.
- Spinners: `<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />` swapped in place of the icon while an action is in flight.
- Abort confirm uses an inline panel, not a modal — keeps focus and context.

## Button + Link Pairings

When a CTA cluster combines a button (action) with a link (navigation), use:

```tsx
<div className="flex items-center gap-3">
  <Button onClick={submit}>Primary action</Button>
  <a className="text-sm text-muted-foreground underline-offset-2 hover:underline">Skip for now</a>
</div>
```

Source: `BusinessProfileWizard` (`wizard.tsx:142-176`) — Back button + Skip link + Next/Submit button. The Skip link is a bare `<button>` styled as text to signal "this is a de-emphasized escape hatch, not navigation away from the flow".

## Verb Choice

Use verbs that describe what happens next, not what the user wants.

| Prefer | Avoid |
|---|---|
| "Get started" | "Sign up" (what if there's no account needed?) |
| "Start investigation" | "Investigate" (ambiguous) |
| "Choose plan" | "See plans" (users are picking, not browsing) |
| "Connect Slack" | "Add integration" (too generic) |
| "Abort investigation" | "Stop" (loses context about what stops) |
| "Rerun" | "Try again" (unclear if it starts fresh) |
| "Resolve" | "Close" (ambiguous — archive vs mark fixed) |

CauseFlow consistently uses **"Get started"** (not "Sign up") across the marketing surface because the primary signup path actually goes through the onboarding flow, not a sign-up form. The marketing CTA at `home-page.tsx:262-268` references `ROUTES.GET_STARTED` and the label comes from `t('hero.ctaPrimary')`.

On the dashboard, verbs are scoped to the domain: **"Start triage" / "Start investigation" / "Abort investigation" / "Rerun"** — each describes a lifecycle transition, not an abstract action.

## Staff / Conditional CTAs

Some actions only appear for specific roles:

```tsx
// incident-action-bar.tsx:87-92
{isStaff && (
  <InvestigationModeSelector
    onRun={onStartInvestigationWithMode}
    isRunning={isInvestigating}
  />
)}
```

The component itself does not enforce the gate — the parent decides via `useIsStaff()`. This keeps the CTA component simple and testable.

Similarly, the choose-plan page sign-out button (`choose-plan-page.tsx:237-245`) is a persistent escape hatch: placed top-right, `text-xs`, muted color so it does not compete with the primary plan selection CTAs below.

## Loading & Disabled States

- Primary button loading: `<Loader2 className="... animate-spin" />` + label swap to progress verb ("Creating account...", "Starting...").
- Disabled via the `disabled` prop on `Button`. The primitive applies `pointer-events: none` + 50% opacity.
- Never block both interactivity **and** show a spinner — pick one. Loading inherently implies disabled.

## Do / Don't

| Do | Don't |
|---|---|
| One primary button per region | Two filled buttons in a hero ("Get started" + "Sign up" both filled) |
| `w-full sm:w-auto` on mobile-first CTAs | Fixed-width buttons that overflow on 360px screens |
| Meaningful verbs scoped to the domain | Generic verbs: "Click here", "Go", "Submit" |
| Swap label + spinner on loading | Show a separate spinner box outside the button |
| Place destructive confirm inline next to the trigger | Open a blocking modal for every confirmation |
| Match CTA color to domain semantic (green for resolved, red for abort) | Use raw Tailwind colors — use theme tokens where possible |

## Drift to Watch

- `IncidentActionBar` uses hand-rolled `<button>` elements with ad-hoc Tailwind instead of the `Button` primitive. Migrating it is a non-trivial refactor (tone classes are very specific), but future action bars should prefer the primitive.
- `ChoosePlanPage`'s plan CTAs are also hand-rolled `<button>` (`choose-plan-page.tsx:392-412`). Same note — migrate when possible.
- The welcome page uses the `Button` primitive at `welcome-page.tsx:116`, which is the correct pattern. Use it as a template when adding new marketing CTAs.
- Marketing uses `Link` wrapped around `Button` (`<Link href=...><Button>...</Button></Link>`). The primitive supports `asChild` which would be cleaner — future cleanup.

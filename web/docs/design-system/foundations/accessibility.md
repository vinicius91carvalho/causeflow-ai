# Accessibility

CauseFlow targets **WCAG 2.1 Level AA** on every surface — marketing, dashboard, and embedded widgets. Accessibility is not a post-launch audit; it is the acceptance bar for every primitive, pattern, and feature component before merge.

## Contrast

- **Text:** minimum 4.5:1 against its background (3:1 for text ≥ 18pt or ≥ 14pt bold).
- **UI components and graphical objects:** minimum 3:1 for borders, focus rings, icon buttons, form input boundaries, chart legend keys.

Every token pair in [`foundations/tokens.md`](./tokens.md) is designed so the foreground variant meets 4.5:1 on its surface. When you combine tokens outside the documented pairs (for example, `text-muted-foreground` on `bg-card`) verify manually.

### How to verify

1. Sample the resolved HSL value from DevTools (`getComputedStyle(element).color` / `backgroundColor`).
2. Convert HSL → HEX, run through a contrast checker (axe DevTools, Stark, WebAIM).
3. For theme work, run the audit in both `light` and `dark` mode and at both the `:root` and `[data-theme="<id>"]` scopes.
4. For text on images or gradients, ensure an overlay (e.g. `bg-background/80`) brings contrast into compliance.

The `tests/audit.spec.ts` Playwright suite includes an axe-core pass — keep it green.

## Focus Visibility

Every interactive element MUST show a visible focus state. Use `:focus-visible`, never `:focus`, so mouse clicks don't flash a ring.

```tsx
<button
  className="
    rounded-md bg-primary text-primary-foreground
    focus-visible:outline-none
    focus-visible:ring-2
    focus-visible:ring-ring
    focus-visible:ring-offset-2
    focus-visible:ring-offset-background
  "
>
  Investigate
</button>
```

Rules:

1. **Always use the `--ring` token** (`focus-visible:ring-ring`). Never hardcode a color.
2. **Always set `ring-offset-background`** so the ring is separated from the element edge regardless of surface.
3. **Never `outline-none` without a compensating `ring`** — removing the default outline without a visible alternative is a WCAG failure.
4. The default ring thickness is `2px`. Increase to `3px` for high-density surfaces (data tables).

## Keyboard Navigation

All interactive elements must be reachable and operable via keyboard alone.

| Element | Expected keys |
|---|---|
| Buttons, links | `Tab` to focus, `Enter` / `Space` to activate |
| Checkbox, switch | `Tab`, `Space` to toggle |
| Radio group | `Tab` to group, arrow keys to move |
| Select / combobox | `Tab` to focus, arrows to navigate, `Enter` to select, `Esc` to close |
| Dialog | `Esc` to close, focus trapped inside, returns to trigger on close |
| Tabs | `Tab` to group, arrows to move between tabs, `Enter` / `Space` to activate |
| Menu | Arrows to navigate, `Enter` to activate, `Esc` to close |

Use Radix primitives (already bundled with shadcn/ui) whenever possible — they implement these behaviors correctly. Do not reimplement focus traps manually.

Tab order must follow DOM order. Avoid positive `tabIndex` values (`tabIndex={1}`). Use `tabIndex={-1}` only to make elements programmatically focusable (e.g. error summaries that receive focus on submit).

## Reduced Motion

All animations must respect `prefers-reduced-motion: reduce`. The global rule is enforced in [`packages/ui/src/themes/shared/base.css`](../../../packages/ui/src/themes/shared/base.css):

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }
  .opacity-0 { opacity: 1 !important; }
  .translate-y-8, .-translate-y-8, .translate-y-5, .-translate-y-5,
  .translate-x-8, .-translate-x-8 { transform: none !important; }
  .scale-95, .scale-\[0\.3\], .scale-\[0\.98\] { transform: none !important; }
}
```

Rules:

1. **Do not set `animation` or `transition` in inline styles** — the global `!important` cannot reach them.
2. **Do not rely on JS animations** (Framer Motion, GSAP) without a `useReducedMotion` gate.
3. **Scroll-triggered reveals** must start visible when reduced motion is set — never hidden-then-revealed. `AnimateOnScroll` handles this automatically via the rule above.
4. The Playwright suite runs with `--force-prefers-reduced-motion` — all screenshots must show fully rendered content.

## Screen Reader Patterns

### Semantic HTML first

Use the correct element for the job before reaching for ARIA:

- Actions → `<button>`, navigation → `<a href>`, not `<div onClick>`.
- Section landmarks → `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`.
- Lists → `<ul>` / `<ol>` / `<li>`. Do not fake lists with divs.
- Headings form a strict outline — never skip levels (`h2` then `h4`).

### Labels for icon-only controls

Any interactive element without visible text needs an accessible name.

```tsx
<button type="button" aria-label="Close dialog">
  <X className="h-4 w-4" aria-hidden="true" />
</button>
```

Always mark decorative icons `aria-hidden="true"`.

### Live regions

Use `aria-live` for content that updates without user interaction:

- Toasts, snackbars → `role="status"` (polite) or `role="alert"` (assertive for errors).
- Investigation status updates (streaming) → `aria-live="polite"` on the container.
- Form-level error summaries shown on submit → `role="alert"` plus programmatic focus.

Do not stack multiple `role="alert"` regions; batch messages into one.

### Images

Informational images need a real `alt`. Decorative images use `alt=""` (empty). Never omit the `alt` attribute — omission is interpreted differently by AT.

## Forms

1. **Label association:** every input needs a `<label htmlFor>` pointing at its `id`, or be wrapped in `<label>`. Placeholder is not a label.
2. **Required fields:** mark with `aria-required="true"` and visual indicator (`*` with `aria-hidden="true"` + visually-hidden "required" text).
3. **Error messages:** link via `aria-describedby` pointing at the error's `id`. Add `aria-invalid="true"` to the input.
4. **Error summary:** on submit, render an error summary at the top of the form with `role="alert"` and move focus into it so AT announces it.
5. **Grouped inputs** (radio groups, address blocks) live inside `<fieldset>` with a `<legend>`.
6. **Autocomplete:** set `autocomplete` on name, email, password, address fields.

```tsx
<div>
  <label htmlFor="email">Work email</label>
  <input
    id="email"
    name="email"
    type="email"
    autoComplete="email"
    aria-required="true"
    aria-invalid={!!error}
    aria-describedby={error ? 'email-error' : undefined}
  />
  {error && (
    <p id="email-error" className="text-destructive">
      {error}
    </p>
  )}
</div>
```

## Reviewer Checklist

Use this when reviewing any PR that changes UI. Every item must pass before approving.

- [ ] All interactive elements render a visible `:focus-visible` ring using the `--ring` token.
- [ ] Every icon-only button / link has an `aria-label` and its decorative `<svg>` is `aria-hidden="true"`.
- [ ] Every form input has a `<label htmlFor>` or wrapping `<label>`.
- [ ] Error states set `aria-invalid` on the input and link to the message with `aria-describedby`.
- [ ] Heading order is sequential — no skipped levels within a route.
- [ ] Landmarks are used correctly (`<main>` appears exactly once per page; nav uses `<nav>`).
- [ ] Color contrast verified in both light and dark mode (4.5:1 text, 3:1 UI).
- [ ] No information conveyed by color alone (status badges pair color with icon or text).
- [ ] All animations disabled or reduced under `prefers-reduced-motion: reduce` — verified via DevTools emulation.
- [ ] Keyboard-only walkthrough of the new flow succeeds: Tab, Shift+Tab, Enter, Space, Esc, arrows.
- [ ] Dialogs trap focus, close on `Esc`, and restore focus to the trigger.
- [ ] Live regions announce asynchronous updates (toasts, streaming status) — test with VoiceOver / NVDA.
- [ ] Images have `alt` attributes; decorative ones use `alt=""`.
- [ ] Text zoom to 200% does not clip or overlap content.
- [ ] The `tests/audit.spec.ts` axe-core pass is green; no new violations introduced.

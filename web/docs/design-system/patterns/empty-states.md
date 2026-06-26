# Empty States

An empty state is what the UI shows when a region has no data to display. The CauseFlow convention treats "no data" as an opportunity to explain *why* and to offer a way forward — never silently render a blank panel.

## Three Reasons a Region Can Be Empty

Always pick the right one — the copy and the visuals differ.

| Reason | Example | Treatment |
|---|---|---|
| **No data yet (pending)** | Investigation running; remediations will appear when it completes | Informational blue/indigo pill, spinner/clock icon, copy that sets expectations |
| **Genuinely empty (terminal)** | Investigation finished; no remediations were needed | Positive emerald pill, check icon, short explanation |
| **Error / fetch failed** | Remediations endpoint returned 500 | Amber alert with `role="alert"`, retry button |
| **Filtered out** | Incidents list has filters that match zero rows | Neutral muted panel, short copy, "Clear filters" link |

## Anatomy

Every empty state is built from four parts. Some may be omitted for minimal variants.

1. **Icon (or illustration)** — Lucide icon at `h-4 w-4` for inline, larger for full-region states. Always `aria-hidden="true"`.
2. **Headline (optional)** — Short sentence; omitted when the state is one-line.
3. **Body** — One or two sentences explaining what happened and what, if anything, will happen next.
4. **Primary action (optional)** — A Retry button, a navigation link, or nothing when the state is terminal.

## Canonical Implementations

### `RemediationsEmptyState`

Source: `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/remediations-empty-state.tsx`.

A single component with three states driven by one prop. This is the reference pattern for data-region empty states — one component, one API, one state union.

```tsx
<RemediationsEmptyState
  state="pending" | "completed-empty" | "error"
  rootCause={optional string — inlined in 'completed-empty' copy}
  onRetry={required for 'error'}
/>
```

- `pending` → blue pill, `<Clock className="animate-pulse">`, "Investigation in progress" copy.
- `completed-empty` → emerald pill, `<CheckCircle2>`, "No remediations needed — root cause was X".
- `error` → amber alert, `<AlertCircle>`, `role="alert"`, Retry button (calls `onRetry`).

All three branches expose `data-testid="remediations-empty-state"` + a `data-state` attribute for E2E tests.

### `FeedbackEmptyState`

Source: `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/feedback-empty-state.tsx`.

Simpler — two states: `empty` (just a muted `<p>`) and `error` (amber alert with Retry). This demonstrates that minimal empty states are fine when the region is small and the context is already clear.

```tsx
<FeedbackEmptyState state="empty" | "error" onRetry={...} />
```

### `DisconnectedBanner` (adjacent pattern)

Source: `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/disconnected-banner.tsx`.

Not strictly an "empty state" but shares the shape: it renders nothing when connected, an `<output aria-live="polite">` blue pill when connecting, and an amber `role="alert"` with Retry when disconnected/errored. Use as the template for any transient-failure banner.

### Marketing empty-ish states

The website does not have data-driven empty states per se. The closest analogs:

- **Coming Soon overlays** — `apps/website/src/contexts/engagement/presentation/components/sections/coming-soon-overlay.tsx` — overlays a "coming soon" message on features that are not yet live. Uses the same pattern: icon + headline + body.
- **Integration filter zero-results** — when the `IntegrationFilter` on `/integrations` matches no rows, a muted message appears inline.

## Composition Rules

1. **One component per region.** `RemediationsSection` owns one `RemediationsEmptyState`; do not inline separate components per state — consolidate the state machine.
2. **Parent owns loading skeleton.** Empty-state components are for **post-fetch terminal states**. Loading skeletons belong in the parent so the empty component doesn't need a `loading` branch. Both `RemediationsEmptyState` and `FeedbackEmptyState` explicitly call this out in their doc comments.
3. **`role="alert"` only for error / assertive states.** Information states (`pending`, `empty`) use neutral or `aria-live="polite"` output. Using `role="alert"` for "no results" creates screen-reader noise.
4. **Retry button ONLY on error.** Do not add a "Refresh" button on `pending` or `completed-empty` — that encourages users to fight the system.
5. **Tone by semantic token, not raw hex.** Pending = blue/indigo (`border-blue-200 bg-blue-50`); success = emerald (`border-emerald-200 bg-emerald-50`); error = amber (`border-amber-300 bg-amber-50`). Each has a dark-mode pair declared on the same element.
6. **Icon always `aria-hidden="true"`.** Meaning comes from the text.

## Example: State Machine Skeleton

When adding a new data region that can be empty:

```tsx
// 1. In your section component:
const { data, loading, error, refetch } = useFoo();

if (loading) return <FooSkeleton />;            // parent owns skeleton
if (error) return <FooEmptyState state="error" onRetry={refetch} />;
if (!data || data.length === 0) {
  return <FooEmptyState state={isInvestigating ? 'pending' : 'completed-empty'} />;
}
return <FooList items={data} />;

// 2. Your FooEmptyState mirrors RemediationsEmptyState: single component, state union.
```

## Drift to Watch

- The older `IncidentFeedback` section historically used inline `{items.length === 0 && <p>Nothing yet</p>}` blocks. Those have been factored into `FeedbackEmptyState`. If you see stray inline empty renders in a section, migrate to a named component.
- `remediations-empty-state.tsx` carries a docstring warning about the previous "no remediations proposed yet" copy being misleading. The three-state replacement was a deliberate rewrite. New empty states should avoid ambiguous phrasing like "no X yet" — say *why* and *what next*.
- Marketing empty states are inconsistent; there is no shared component. If this surface grows, promote a `MarketingEmptyState` into `@causeflow/ui` with the same three-state API.

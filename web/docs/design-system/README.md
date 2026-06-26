# CauseFlow Design System

The CauseFlow design system is the single source of truth for visual language, interaction patterns, and UI primitives across `apps/website` (marketing) and `apps/dashboard` (product). It ships as the `@causeflow/ui` package plus a documentation set. Themes, tokens, and primitives are versioned together so both surfaces stay visually and behaviorally consistent.

## Table of Contents

| Section | Scope |
|---|---|
| [`foundations/`](./foundations/) | Tokens, theme model, accessibility baseline, voice and tone |
| [`primitives/`](./primitives/) | Low-level shadcn/ui-style components in `packages/ui` (button, input, dialog, etc.) |
| [`features/`](./features/) | Cross-app feature components (e.g. theme switcher, toast provider, animation wrappers) |
| [`patterns/`](./patterns/) | Composition recipes (forms, empty states, loading, error, dialogs) and page-level layouts |

### Foundations (this sprint)

- [`foundations/tokens.md`](./foundations/tokens.md) — color, spacing, radius, typography, motion tokens
- [`foundations/theme-model.md`](./foundations/theme-model.md) — how theming works and how to add a theme
- [`foundations/accessibility.md`](./foundations/accessibility.md) — WCAG 2.1 AA baseline and reviewer checklist
- [`foundations/voice-and-tone.md`](./foundations/voice-and-tone.md) — brand voice and surface-specific tone

## How to Contribute

1. **New primitives live in `packages/ui/src/components/`.** They must consume tokens via semantic Tailwind classes (`bg-primary`, `text-muted-foreground`) — never raw HSL values.
2. **Update tokens only via `packages/ui/src/themes/shared/base.css` (semantic mapping) or the per-theme token files under `packages/ui/src/themes/<theme>/tokens/{light,dark}.css`.** Never redefine CSS variables in app code.
3. **One change, one theme first.** Validate in `original` theme before propagating token-level changes to `organic-tech`, `midnight-luxe`, `brutalist-signal`, and `vapor-clinic`.
4. **Any visual change requires a screenshot in the PR** covering both light and dark modes, plus `prefers-reduced-motion` verification for animations. Use `.artifacts/playwright/screenshots/`.
5. **Document before merging.** A new primitive gets an entry under `primitives/`; a new pattern gets an entry under `patterns/`; a new token gets added to `foundations/tokens.md` in the same PR.

## Primitive vs Pattern vs Feature Component

Use the table below to decide where code belongs. When two rows could apply, pick the lowest tier (primitive < pattern < feature).

| Tier | Use when | Location | Examples |
|---|---|---|---|
| **Primitive** | Stateless or near-stateless building block with no business logic. Consumes tokens only. Reusable in any app. | `packages/ui/src/components/` | `Button`, `Input`, `Dialog`, `Select`, `Tabs`, `Badge` |
| **Pattern** | Deterministic composition of 2+ primitives solving a recurring UI problem. No domain knowledge. | `packages/ui/src/patterns/` or documented in `patterns/` | Form field group, empty state, confirmation dialog, data table shell |
| **Feature component** | Bounded-context UI tied to a specific domain (investigation, billing, onboarding). Can call repositories, use feature flags, own domain state. | `apps/<app>/src/contexts/<context>/presentation/components/` | `HypothesisDebateView`, `BusinessProfileForm`, `InvestigationTimeline` |

## Related References

- Theme spec: [`packages/ui/src/themes/THEMES.md`](../../packages/ui/src/themes/THEMES.md)
- Bounded contexts: [`docs/architecture/bounded-contexts.md`](../architecture/bounded-contexts.md)
- Project root: [`CLAUDE.md`](../../CLAUDE.md)

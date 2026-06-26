# Sprint 07 (Deferred) — Cleric.ai Parity Audit

**Status:** Deferred — pending user evaluation.
**Created:** 2026-04-19
**Scope:** Full design/motion/content comparison of causeflow.ai vs cleric.ai reference, web + dashboard.

## Why deferred

Sprint 05 (Website persona review) + Sprint 06 (P0 remediation: AnimateOnScroll SSR,
dynamic-import skeletons, compliance copy) shipped. User wants to evaluate whether full
cleric.ai parity pass is warranted before queuing this work. Sprint 06b (Dashboard
persona audit) runs ahead of this.

## Proposed scope

### Reference
Side-by-side comparison of `https://cleric.ai` live site with `https://causeflow.ai`
(and dashboard where analogous surfaces exist).

### Personas (parallel)

| Persona | Focus |
|---|---|
| UX Designer | Layout, spacing, typography scale, visual hierarchy, responsive breakpoints |
| Motion Designer | Animation cadence vs cleric.ai — timing curves, easing, choreography, microinteractions, loading states |
| Content Strategist | Copy voice, section order, information density, heading hierarchy, CTA pattern |

### Surfaces

**Website (9 routes):**
- `/`, `/product`, `/use-cases`, `/integrations`, `/pricing`, `/security`
- `/privacy`, `/terms` (legal)
- `/pt-br/*` locale mirror — spot-check 2 routes

**Dashboard (post-auth):**
- Skip if Sprint 06b already covers. Otherwise cross-reference findings.

### Viewports
Mobile 390 / Tablet 768 / Desktop 1440. Light + dark.

### Deliverables
- `docs/redesign-review/sprint-07/ux-designer.md` — min 10 obs
- `docs/redesign-review/sprint-07/motion-designer.md` — min 8 obs
- `docs/redesign-review/sprint-07/content-strategist.md` — min 8 obs
- `docs/redesign-review/sprint-07/prioritized-issues.md` — consolidated, deduped

### Acceptance
- Each persona doc has Summary paragraph naming the systemic pattern observed.
- Observations reference exact cleric.ai element and the causeflow counterpart.
- prioritized-issues.md groups by theme (motion, typography, IA, copy) not by page.
- User signs off before queuing remediation sprint.

## Blockers before dispatch

1. **Reference access:** cleric.ai live URL reachable from dev environment via
   Playwright / WebFetch. If Cloudflare blocks, user supplies screenshots.
2. **Remediation sprint (Sprint 08) is NOT planned yet** — this sprint only produces
   findings. Remediation is separate and depends on findings severity.

## Out of scope

- Implementing any fix — findings-only audit.
- Dashboard-specific flows (covered by Sprint 06b).
- Performance deltas (CTO persona runs that in Sprint 05/06b already).
- SEO / metadata audit (separate concern).

## Related

- Sprint 05 spec: `docs/tasks/website/design/2026-04-18_1900-cleric-redesign/`
- Sprint 06 P0 fixes: commit log after `b0a9224`
- Sprint 06b (in progress): `docs/redesign-review/sprint-06b-dashboard/`

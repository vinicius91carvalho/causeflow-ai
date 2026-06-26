# Sprint 2: Integrations Page Redesign

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 2 of 3
- **Depends on:** Sprint 1
- **Batch:** 2 (parallel with Sprint 3)
- **Model:** sonnet
- **Estimated effort:** M

## Objective

Redesign the integrations page to showcase ~30 curated integrations with "1,000+ connections" headline, updated categories, agent-usage context, and an integration security section. Remove all phase-related UI.

## File Boundaries

### Creates (new files)

None expected — work is in existing components.

### Modifies (can touch)

- `apps/website/src/contexts/marketing/presentation/pages/integrations-page.tsx` — Update hero section with 1,000+ count, add integration security principles, update ContactCTASection copy
- `apps/website/src/contexts/marketing/presentation/components/sections/integration-filter.tsx` — Remove phase filtering logic, update category tabs (add Cloud, CI/CD), remove MVP/future styling distinction, update status badges
- `apps/website/src/contexts/marketing/presentation/components/sections/integration-card.tsx` — Remove phase badge, add agentConnection display, make all cards full-color (remove grayscale/opacity for non-MVP)

### Read-Only (reference but do NOT modify)

- `packages/shared/src/domain/types/index.ts` — Read updated Integration type
- `packages/shared/src/domain/constants/integrations.ts` — Read updated INTEGRATIONS array
- `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` — Read i18n keys (DO NOT modify — Sprint 1 handles all i18n)
- `apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json` — Read i18n keys (DO NOT modify)
- `apps/website/src/contexts/marketing/presentation/components/sections/security-commitment-card.tsx` — Reference design pattern for security cards
- `apps/website/src/contexts/marketing/presentation/components/common/section-layout.tsx` — Reference layout patterns

### Shared Contracts (consume from prior sprints or PRD)

- Updated `Integration` interface (from Sprint 1) — no `phase`, has `agentConnection`, `featured`
- New category values: `'cloud'`, `'ci-cd'` (from Sprint 1)
- New i18n keys under `integrations.*` (from Sprint 1)

### Consumed Invariants (from INVARIANTS.md)

- White-label constraint — zero occurrences of "composio" in any file
- Integration.category values — category filter tabs must match the category union type

## Tasks

- [x] Update integrations page hero section:
  - Add large "1,000+" count display (prominent, styled like a metric)
  - Update title to emphasize breadth: "Connect to 1,000+ tools your team already uses"
  - Update subtitle to mention agent-driven integration and security
- [x] Update IntegrationFilter component:
  - Remove all phase-related filtering (no more "Available Now" / "On the Roadmap" status badges)
  - Add new category tabs: "Cloud Infrastructure", "CI/CD" (alongside existing categories)
  - Remove `phases` legend/status badges
  - All integrations render equally (full color, full opacity, interactive hover)
  - Update category tab ordering: All, Monitoring, Communication, Code, Management, Knowledge, CRM, Database, Cloud, CI/CD, API
- [x] Update IntegrationCard component:
  - Remove phase badge rendering
  - Remove grayscale/opacity styling for non-MVP integrations
  - Add agentConnection display (small badge showing which CauseFlow agent uses this integration, e.g. "Used by: Log Analyst, Metric Analyst")
  - All cards get the bright/interactive styling (currently MVP-only)
- [x] Add integration security principles section (below catalog, above CTA):
  - SOC 2 & ISO 27001:2022 certified integration infrastructure
  - OAuth 2.0 with minimal scopes
  - Encrypted credential storage (AES-256)
  - Read-only by default
  - Per-tenant credential isolation
  - Automatic token refresh and lifecycle management
  - Use the existing principles section layout (6 cards in grid) — update content
- [x] Update final CTA section if needed (messaging should reflect breadth)
- [x] Verify no "composio" references in modified files

## Acceptance Criteria

- [x] Hero section shows "1,000+" count prominently
- [x] No phase badges, phase filters, or phase-related styling visible
- [x] All ~30 integrations render in full color with hover effects
- [x] Category tabs include "Cloud Infrastructure" and at least reflect all categories in the data
- [x] Each integration card shows which CauseFlow agent uses it
- [x] Integration security section shows SOC 2 + ISO 27001:2022 for integration infrastructure
- [x] Security section does NOT claim CauseFlow holds these certifications
- [x] `grep -ri "composio"` in modified files returns zero results
- [x] Page is responsive (mobile-first): 1 col mobile, 2 cols tablet, 3 cols desktop

## Verification

- [x] Build passes: `pnpm turbo build`
- [x] Lint passes: `pnpm exec biome check .`
- [x] Type-check passes: `pnpm turbo check-types`
- [x] White-label check: `grep -ri "composio" apps/website/src/contexts/marketing/presentation/ || echo "CLEAN"`

> **Note:** Dev server smoke test and content verification are handled by the orchestrator after merge — do not run in the sprint-executor. Sprint-executors do static verification only.

## Context

### Current IntegrationFilter Architecture

The IntegrationFilter is a client component (`"use client"`) that:
1. Imports INTEGRATIONS from `@causeflow/shared`
2. Uses `useState` for active category tab
3. Filters integrations by category
4. Renders IntegrationCard for each integration
5. Currently has phase-based styling (MVP = bright, future = grayscale 60% opacity)
6. Has status legend: "Available Now" (green dot) + "On the Roadmap" (muted dot)

### Current IntegrationCard Architecture

Each card shows:
- Integration name + icon
- Category badge
- Description
- Phase badge (MVP, V1, V2, V3) — REMOVE THIS
- Differentiator text if present
- Hover: translate-y + shadow glow (MVP only) — EXTEND TO ALL

### Agent Connection Display

New field `agentConnection` maps each integration to CauseFlow agent(s). Display as a subtle tag/badge below the description, e.g.:

```
[Datadog]
Metrics, logs, traces, and alerts.
🔗 Log Analyst · Metric Analyst
```

This reinforces the AI-agent-driven value proposition without being technical.

### Integration Security Section

Replace the current "Integration Principles" section (6 cards about setup, read-only, etc.) with an updated version that includes security certification messaging:

1. **SOC 2 Certified Infrastructure** — All integration connections run through SOC 2 certified infrastructure
2. **ISO 27001:2022** — Information security management certified to international standards
3. **OAuth 2.0 & Minimal Scopes** — Secure authentication with the minimum permissions needed
4. **Encrypted Credentials** — All tokens and API keys encrypted at rest (AES-256)
5. **Read-Only by Default** — Agents only read data; write operations require explicit human approval
6. **Per-Tenant Isolation** — Credentials are isolated per tenant; one tenant never accesses another's connections

## Agent Notes (filled during execution)

- Assigned to: sprint-executor / claude-sonnet-4-6
- Started: 2026-04-01
- Completed: 2026-04-01
- Decisions made:
  - Count metric rendered as a standalone banner div below HeroSection rather than using HeroSection's `children` prop. The children prop triggers a two-column `lg:flex-row` layout which would place count beside the hero text, not below it. The standalone banner preserves centered full-width display on the dark background. 🟢 HIGH confidence.
  - Used `FeatureCard` (not `SecurityCommitmentCard`) for the 6 security cards — FeatureCard accepts an icon prop matching the existing integration-icons, creating visual consistency with the original principles section. SecurityCommitmentCard has no icon slot.
  - `IntFilterIcon` removed from integrations-page.tsx imports (was already imported but no longer needed after section replacement — caught by biome post-edit hook).
  - CI/CD tab added to CATEGORIES array even though no CI/CD integrations exist in data yet. Forward-compatible; shows empty state when selected. 🟡 MEDIUM confidence (no data = empty tab visible to users, but Sprint 1 established the type).
- Assumptions:
  - Sprint 1 already removed phase from Integration type and all data — confirmed by reading the types file. 🟢 HIGH
  - `integration-filter.tsx` had already been cleaned of phase-related status badges by Sprint 1. Confirmed by reading the file — no phase logic or status legend present. 🟢 HIGH
  - `integration-card.tsx` had already been cleaned of phase badge by Sprint 1. Confirmed. 🟢 HIGH
- Issues found:
  - The integrations-page.test.tsx had an incorrect relative import path (3 levels up instead of 2 from pages/ to infrastructure/). Fixed before type-check ran.
  - No CI/CD integrations exist in the INTEGRATIONS constant. The 'ci-cd' tab will show but render an empty grid. This is a data gap from Sprint 1, not a Sprint 2 responsibility.

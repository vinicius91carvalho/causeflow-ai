# Composio Integration Overhaul: Product Requirements Document

## 1. What & Why

**Problem:** CauseFlow's website currently shows only 17 integrations across phased releases (MVP/V1/V2/V3), many grayed-out as "future." This undersells the platform's actual capability now that we have access to Composio's full 1,000+ integration platform. The security page also lacks integration-layer security certifications (SOC 2, ISO 27001:2022) that Composio provides, missing a key trust signal.

**Desired Outcome:** Website reflects CauseFlow's true integration breadth — 1,000+ connections available, ~30 curated integrations highlighted by agent relevance, all shown as available (no phased roadmap). Security messaging accurately conveys that the integration infrastructure is SOC 2 and ISO 27001:2022 certified. Homepage features a compelling integration carousel and count. All changes are white-labeled — zero mention of Composio.

**Justification:** Integration breadth is a top purchasing signal for SRE platforms. Competitors (incident.io, Rootly) prominently display integration counts. CauseFlow having access to 1,000+ connections but showing only 17 is leaving trust and credibility on the table. Additionally, the integration-layer SOC 2/ISO 27001 certifications are a major differentiator for enterprise sales.

## 2. Correctness Contract

**Audience:** Engineering managers and SRE leads evaluating CauseFlow — they need to see that their existing tools (Datadog, PagerDuty, Slack, Jira, etc.) are supported, that the platform has broad reach, and that integrations are security-compliant. Decision: "Can CauseFlow connect to our stack?"

**Failure Definition:** If featured integrations don't match what CauseFlow's agents actually use, or if integration counts are inaccurate, visitors will lose trust. If the phase system persists, it signals immaturity.

**Danger Definition:** Claiming CauseFlow itself holds SOC 2 Type II or ISO 27001 when it doesn't. The messaging must be precise: "our integration infrastructure" is certified, not CauseFlow as a whole. CauseFlow's own SOC 2 Type II remains "In Progress."

**Risk Tolerance:** Prefer accuracy over impressiveness. A conservative but truthful claim ("integration infrastructure certified SOC 2 & ISO 27001:2022") is better than an overstated one.

## 3. Context Loaded

- **`core/docs/product/07-ai-system.md`:** CauseFlow has 8 agents (+1 planned doc_enricher). Each agent connects to specific tool categories — log_analyst needs CloudWatch/Datadog/Splunk, code_analyzer needs GitHub/GitLab, doc_enricher needs Notion/Confluence. Integration relevance is agent-driven.
- **`core/docs/product/03-modules.md`:** Ingestion module supports Datadog, Grafana, CloudWatch, Sentry parsers. Integration module handles GitHub App + OAuth (Notion, Shortcut, Trello). Planned: Slack, PagerDuty, Jira/Linear, HubSpot, Confluence.
- **`core/docs/product/13-relay-integration.md`:** DB Analyst uses a Relay container for PostgreSQL/MongoDB access — zero inbound, read-only, PII masking. This is a unique security story for database integrations.
- **Composio research:** 982 toolkits (marketed as 1,000+), SOC 2 certified, ISO 27001:2022 certified, 20 categories, OAuth2/API key management, white-label support, encrypted credential storage.
- **Current website state:** 17 integrations with MVP/V1/V2/V3 phases, TechLogoCarousel on homepage (2 rows), IntegrationFilter with 9 category tabs, security page shows SOC 2 Type II as "In Progress."

## 4. Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Integrations shown | 17 (9 active, 8 grayed) | ~30 curated + "1,000+ available" | Count on integrations page |
| Phase badges | 4 phases (mvp/v1/v2/v3) | 0 phases — all available | Visual inspection |
| Integration security certs on security page | 0 | SOC 2 + ISO 27001:2022 | Visual inspection |
| Homepage integration count | Not shown | "1,000+" prominently displayed | Visual inspection |
| Lighthouse performance | Current baseline | No regression | Lighthouse audit |

## 5. User Stories

GIVEN a visitor on the homepage
WHEN they scroll to the integration section
THEN they see "1,000+ integrations" prominently, with a carousel showing key tools (Slack, GitHub, Datadog, PagerDuty, Jira, etc.) in full color with no grayed-out items

GIVEN a visitor on the integrations page
WHEN they browse the catalog
THEN they see ~30 curated integrations organized by category, all marked as available, with a headline of "1,000+ connections" and agent-usage context

GIVEN a security-conscious buyer on the security page
WHEN they review compliance information
THEN they see that the integration infrastructure is SOC 2 and ISO 27001:2022 certified, with details on OAuth security, encrypted credentials, and read-only defaults

GIVEN a PT-BR visitor
WHEN they view any of these pages
THEN all new content is fully translated

## 6. Acceptance Criteria

- [ ] Integration type no longer has `phase` field; all integrations render as "available"
- [ ] INTEGRATIONS constant contains ~30 curated integrations relevant to CauseFlow's agents
- [ ] Homepage shows "1,000+" integration count prominently
- [ ] Homepage TechLogoCarousel shows all integrations in full color (no grayed-out items)
- [ ] Integrations page shows curated catalog with updated categories
- [ ] Integrations page hero displays "1,000+ connections" messaging
- [ ] Security page has new "Integration Security" section with SOC 2 and ISO 27001:2022 messaging
- [ ] CauseFlow's own SOC 2 Type II stays "In Progress" — NOT changed to compliant
- [ ] Zero mentions of "Composio" in any file (code, i18n, comments)
- [ ] All new content translated to PT-BR
- [ ] Build passes, lint passes, type-check passes
- [ ] No Lighthouse performance regression

## 7. Non-Goals

- **Dashboard Composio integration (backend)** — Only the website (marketing) pages are in scope. The actual API/backend integration with Composio is a separate task.
- **Full 982-integration browsable catalog** — We show ~30 curated + "1,000+ available" headline. Building a searchable catalog of all integrations requires backend data from Composio API and is out of scope.
- **Changing CauseFlow's own SOC 2/ISO 27001 status** — We cannot claim certifications we don't hold. Only the integration infrastructure's certifications are promoted.
- **New integration detail pages** — No individual pages per integration. The catalog view is sufficient.
- **Composio SDK integration** — No code imports from Composio. This is marketing content only.

## 8. Technical Constraints

- **Stack:** Next.js App Router, TypeScript, Tailwind CSS, Shadcn/ui, next-intl
- **Architecture:** DDD bounded contexts in `apps/website/src/contexts/marketing/`
- **i18n:** All text in `en.json` and `pt-br.json` — no hardcoded strings
- **Performance:** No new JS bundles. Use existing patterns (AnimateOnScroll, dynamic imports, CSS animations). Images lazy-loaded, WebP format.
- **White-label:** Zero reference to Composio in any file — code, comments, i18n keys, variable names
- **No barrel imports:** Use direct deep paths per project convention

## 9. Architecture Decisions

| Decision | Reversal Cost | Alternatives Considered | Rationale |
|----------|--------------|------------------------|-----------|
| Remove `phase` from Integration type entirely | Med | Keep phase but default all to 'available' | Clean break. Phase system adds complexity for zero value now. Reversal requires re-adding field + data. |
| Show "1,000+" as headline with ~30 curated | Low | Show all 982 with search | Curated is more impactful for marketing, requires no backend, low maintenance. Can expand later. |
| Add new categories (cloud, ci-cd) to Integration type | Low | Keep existing 8 categories | Agents map to more categories than the current 8. Adding categories improves discoverability. |
| Separate integration security messaging from CauseFlow's own certs | Low | Merge into one compliance section | Critical to avoid false claims. Integration infra certs ≠ CauseFlow platform certs. Must be distinct. |

## 10. Security Boundaries

- **No auth changes** — All pages are public marketing pages
- **No user input** — No forms or dynamic data; all content is static/i18n
- **Messaging accuracy** — Integration security claims must accurately attribute certifications to the integration infrastructure, not to CauseFlow itself
- **White-label integrity** — No Composio references must leak through code, comments, or source maps

## 11. Data Model

No database changes. Only static TypeScript types and constants.

**Updated Integration type:**
```typescript
export interface Integration {
  id: string;
  name: string;
  category: 'communication' | 'code' | 'monitoring' | 'management' | 'crm' | 'database' | 'knowledge' | 'api' | 'cloud' | 'ci-cd';
  description: string;
  differentiator?: string;
  icon?: string;
  agentConnection?: string; // Which CauseFlow agent uses this integration
  featured?: boolean; // Show in homepage carousel
}
```

## 12. Shared Contracts

### Updated Integration Type
The `Integration` interface in `packages/shared/src/domain/types/index.ts` is consumed by:
- `packages/shared/src/domain/constants/integrations.ts`
- `apps/website/src/contexts/marketing/presentation/components/sections/integration-filter.tsx`
- `apps/website/src/contexts/marketing/presentation/components/sections/integration-card.tsx`
- `apps/website/src/contexts/marketing/presentation/components/sections/tech-logo-carousel.tsx`

### Integration Categories
New union type adding `'cloud'` and `'ci-cd'` to existing categories.

### i18n Key Structure (new keys)
```
integrations.hero.count — "1,000+ Connections"
integrations.hero.subtitle — Updated subtitle
integrations.categories.cloud — "Cloud Infrastructure"
integrations.categories.ciCd — "CI/CD"
integrations.security.* — Integration security section
home.techBar.count — "1,000+"
home.techBar.countLabel — "integrations available"
security.integrationSecurity.* — New integration security section
```

## 13. Architecture Invariant Registry

| Concept | Owner | Format/Values | Verify Command |
|---------|-------|---------------|----------------|
| Integration.category values | `packages/shared/src/domain/types/index.ts` | Union type of category strings | `grep -c "category:" packages/shared/src/domain/constants/integrations.ts` matches category filter tabs |
| White-label constraint | All files | Zero occurrences of "composio" | `grep -ri "composio" apps/website/ packages/ \|\| echo "clean"` |
| CauseFlow SOC 2 status | i18n files | Must remain "In Progress" | `grep -l "In Progress" apps/website/src/contexts/marketing/infrastructure/i18n/en.json` |

## 14. Open Questions

- [x] How many integrations to show? → ~30 curated + "1,000+ available" headline
- [x] Can we claim SOC 2 Type II? → No. Say "integration infrastructure is SOC 2 certified"
- [x] Remove phase system? → Yes, completely
- [x] Dashboard in scope? → No, website only

## 15. Uncertainty Policy

When uncertain: **Flag** — document assumption and continue. Marketing copy nuances can be refined in review.
When security claim accuracy conflicts with marketing impact: prefer **accuracy** always.

## 16. Verification

**Deterministic:**
- `pnpm turbo build` — build passes
- `pnpm exec biome check .` — lint passes
- `pnpm turbo check-types` — type-check passes
- `grep -ri "composio" apps/website/ packages/` — returns zero results
- `grep "In Progress" apps/website/src/contexts/marketing/infrastructure/i18n/en.json` — SOC 2 still "In Progress"

**Manual:**
- Homepage: integration count visible, carousel shows key integrations in full color
- Integrations page: ~30 integrations, no phase badges, updated categories
- Security page: integration security section with SOC 2 + ISO 27001 messaging
- PT-BR: all new content translated
- No "Composio" visible anywhere (source view + rendered)

## 17. Sprint Decomposition

### Sprint Overview

| Sprint | Title | Depends On | Batch | Model | Parallel With |
|--------|-------|------------|-------|-------|---------------|
| 1 | Data Foundation | None | 1 | sonnet | — |
| 2 | Integrations Page | Sprint 1 | 2 | sonnet | Sprint 3 |
| 3 | Homepage + Security Page | Sprint 1 | 2 | sonnet | Sprint 2 |

### Sprint 1: Data Foundation → `sprints/01-data-foundation.md`

**Objective:** Update Integration type, populate ~30 curated integrations, add all i18n keys for all 3 pages.
**Estimated effort:** M
**Dependencies:** None

### Sprint 2: Integrations Page Redesign → `sprints/02-integrations-page.md`

**Objective:** Redesign integrations page with 1,000+ headline, curated catalog, new categories, and integration security section. Remove all phase-related UI.
**Estimated effort:** M
**Dependencies:** Sprint 1

### Sprint 3: Homepage + Security Page → `sprints/03-homepage-security.md`

**Objective:** Update homepage TechLogoCarousel and integration count. Add integration security section to security page with SOC 2 + ISO 27001 messaging.
**Estimated effort:** M
**Dependencies:** Sprint 1

## 18. Execution Log

[Filled during execution — tracked in progress.json]

## 19. Learnings (filled after all sprints complete)

[Compound step output]

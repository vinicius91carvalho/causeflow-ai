# Plan 3: Integrations Page — Match Website with All 15 Integrations & Colorful Images

## Context
- Dashboard integrations page only shows 6 integrations (Slack, PagerDuty, Datadog, GitHub, Jira, CloudWatch)
- Website shows 15 integrations with colorful SVG icons and rich descriptions
- Dashboard uses generic monochrome icons — needs colorful branded images
- Integration type enum is limited to 6 in the dashboard
- Categories in dashboard don't match website categories

## Current State (Dashboard)
- `IntegrationType = 'slack' | 'pagerduty' | 'datadog' | 'github' | 'jira' | 'cloudwatch'`
- 6 integration cards with basic descriptions
- Categories: Communication, Monitoring, Code, Project Management, Alerting
- Monochrome/generic icons
- Connection modal exists but only for the 6 types

## Target State (from Website)
15 integrations across 9 categories:
1. **Slack** (communication, MVP) — colorful icon
2. **GitHub** (code, MVP) — colorful icon
3. **Jira** (management, MVP) — colorful icon
4. **AWS CloudWatch** (monitoring, MVP) — colorful icon
5. **HubSpot** (crm, MVP) — colorful icon (unique differentiator!)
6. **Trello** (management, MVP) — colorful icon
7. **PostgreSQL/MySQL** (database, v1) — colorful icon
8. **Linear** (management, v1) — colorful icon
9. **Sentry** (monitoring, v2) — colorful icon
10. **MongoDB** (database, v2) — colorful icon
11. **Datadog** (monitoring, v2) — colorful icon
12. **PagerDuty** (monitoring, v2) — colorful icon
13. **Grafana** (monitoring, v2) — colorful icon
14. **Confluence** (knowledge, v2) — colorful icon
15. **Custom Webhooks** (api, v3) — colorful icon

## Phase 1: Extend Integration Types
- [x] Update `IntegrationType` in `apps/dashboard/src/lib/db/types.ts` to include all 15 types
- [x] Update Zod validation schemas for new types
- [x] Add credential schemas for new integration types in API routes
- [x] Ensure `IntegrationRepository` works with new types

## Phase 2: Copy SVG Icons to Dashboard
- [x] Copy all 17 SVG files from `apps/website/public/icons/integrations/` to `apps/dashboard/public/icons/integrations/`
- [x] Verify SVGs render correctly in the dashboard

## Phase 3: Update Integration Catalog
- [x] Create a shared integration catalog constant (or import from `@causeflow/shared`):
  - Use `INTEGRATIONS` from `packages/shared/src/domain/constants/integrations.ts`
  - Each entry: id, name, description, category, icon path, phase, differentiator
- [x] Update `IntegrationsClient` component to use the full catalog
- [x] Show all 15 integrations with proper icons, descriptions, categories
- [x] Mark non-MVP integrations with "Coming Soon" badge (v1, v2, v3 phases)
- [x] Only MVP integrations should have active "Connect" buttons

## Phase 4: Update Categories/Filters
- [x] Update `CategoryFilter` to match website categories:
  - All, Communication, Code, Monitoring, Management, CRM, Database, Knowledge, API
- [x] Ensure filtering works correctly with all 15 integrations

## Phase 5: Colorful Integration Cards
- [x] Update `IntegrationCard` to display colorful SVG icons (not monochrome)
- [x] Add brand colors per integration (subtle background tint or colored border)
- [x] Show integration phase badge (MVP = active, v1/v2/v3 = "Coming Soon")
- [x] Show differentiator text for unique integrations (especially HubSpot)

## Phase 6: Update New Analysis Form
- [x] Update the data sources checkboxes in `NewAnalysisForm` to show all MVP integrations
- [x] Use colorful icons in the form checkboxes
- [x] Only show connected integrations as selectable data sources

## Phase 7: Tests
- [x] Unit tests for integration catalog rendering
- [x] E2E test: all 15 integrations visible on page
- [x] E2E test: category filtering works
- [x] E2E test: search filtering works
- [x] E2E test: "Coming Soon" badge on future integrations

## Key Files to Modify
- `apps/dashboard/src/lib/db/types.ts` — extend IntegrationType
- `apps/dashboard/src/components/integrations/integrations-client.tsx` — use full catalog
- `apps/dashboard/src/components/integrations/integration-card.tsx` — colorful icons
- `apps/dashboard/src/components/integrations/category-filter.tsx` — all 9 categories
- `apps/dashboard/src/components/analyses/new-analysis-form.tsx` — update data sources
- `apps/dashboard/src/app/api/integrations/route.ts` — support new types
- NEW: `apps/dashboard/public/icons/integrations/` — all 17 SVG files

## Status: COMPLETED
Completed on 2026-02-25. All 26 checkboxes marked as completed.

# Plan 2: Analysis Lifecycle — Simulated AI Processing with Real Results

## Context
- Analysis creation works (stored in DynamoDB) but status stays "queued" forever
- No AI engine exists yet — we need to simulate realistic analysis processing
- The analysis detail page (`/dashboard/analyses/[id]`) crashes with "Something went wrong"
- User wants to see how analyses will behave in production

## Current State
- `POST /api/analyses` creates analysis with `status: 'queued'`
- `GET /api/analyses/[id]` fetches from DynamoDB but detail page crashes
- Analysis schema supports: result, confidence, timeline, recommendations, auditTrail, dataSources
- No background processing — status never transitions
- AnalysisDetail component exists with Timeline, AuditTrail, ConfidenceIndicator components

## Suggested Prompt for Testing
When creating an analysis, use this prompt to see realistic behavior:
> "Our payment processing service (payments-api) started returning 500 errors at 2:34 AM UTC. CloudWatch shows a spike in Lambda cold starts and DynamoDB throttling on the orders table. Customer complaints coming in via Slack #incidents channel. Affects checkout flow for all regions."

## Phase 1: Fix Analysis Detail Page Crash
- [x] Debug why `/dashboard/analyses/[id]` crashes — likely the API route returns data in unexpected format or the component doesn't handle missing fields
- [x] Ensure `GET /api/analyses/[id]` returns proper response for all analysis states
- [x] Add null checks / loading states for optional fields (result, confidence, timeline, etc.)

## Phase 2: Simulated Analysis Processing
- [x] After creating an analysis, trigger a simulated processing pipeline:
  - Option A (recommended): Server-side simulation in the POST handler
    - Create analysis with `status: 'queued'`
    - Use `setTimeout` or a fire-and-forget async function to:
      1. After 2s: update status to `running`, add audit trail entry
      2. After 8-15s: update status to `completed`, generate mock results
  - Option B: Client-side polling + separate status update endpoint
- [x] Generate realistic mock results based on the prompt:
  - `result`: A plausible root cause analysis text (template-based, varies by severity)
  - `confidence`: 72-95% range (randomized)
  - `recommendations`: 3-5 actionable items (template-based)
  - `timeline`: Timeline of investigation steps with timestamps
  - `dataSources`: What data was "analyzed" (based on selected integrations)
  - `auditTrail`: Event log of the investigation process

## Phase 3: Result Templates
- [x] Create result templates for different incident types:
  - Database issues (throttling, connection pool, deadlocks)
  - Service errors (500s, timeouts, cold starts)
  - Infrastructure issues (CPU, memory, disk, network)
  - Deployment issues (bad deploy, config change, dependency)
- [x] Template selection based on keyword analysis of the prompt
- [x] Each template includes: root cause text, confidence range, recommendations, timeline events

## Phase 4: Analysis Detail Page Polish
- [x] Ensure the detail page renders all sections properly:
  - Header: prompt, severity badge, status badge, created/completed timestamps
  - Root Cause section: result text with confidence indicator
  - Timeline: visual step-by-step of the investigation
  - Recommendations: actionable list with priority indicators
  - Data Sources: what integrations/data were consulted
  - Audit Trail: full event log
- [x] Add real-time status polling while analysis is "queued" or "running"
- [x] Show a progress animation during processing
- [x] Add "Re-run Analysis" button for completed analyses

## Phase 5: Analysis List Updates
- [x] Ensure analyses list shows all statuses correctly
- [x] Add click-through from list to detail page
- [x] Show analysis prompt preview in the list
- [x] Verify pagination works with real data

## Phase 6: Tests
- [x] Unit tests for result template generation
- [x] Unit tests for keyword-based template selection
- [x] Integration test: create analysis → poll → completed
- [x] E2E test: full analysis lifecycle (create → view detail → verify results)
- [x] E2E test: analysis list filtering by status

## Key Files to Modify
- `apps/dashboard/src/app/api/analyses/route.ts` — add simulation trigger
- `apps/dashboard/src/app/api/analyses/[id]/route.ts` — fix response format
- `apps/dashboard/src/lib/db/repositories/analysis-repository.ts` — add status update method
- `apps/dashboard/src/components/analyses/analysis-detail.tsx` — fix crashes, add polling
- `apps/dashboard/src/components/analyses/analyses-list.tsx` — verify click-through
- NEW: `apps/dashboard/src/lib/analysis-simulator.ts` — simulation engine
- NEW: `apps/dashboard/src/lib/analysis-templates.ts` — result templates

## Status: COMPLETED
Completed on 2026-02-25. All 27 checkboxes marked as completed.

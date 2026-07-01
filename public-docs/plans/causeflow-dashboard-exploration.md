# CauseFlow Dashboard Exploration Plan

## Task
Read and analyze 16 files to understand integration components, Sentry setup, E2E tests, types, and API client structure.

## Files to Read (Delegated to Explore Sub-agent)

### Already Completed (Main Agent)
1. ✅ integrations-page.tsx — delegates to IntegrationsClient
2. ✅ integration-card.tsx — renders connect/disconnect/test buttons; status enum: connected, error, disconnected, available
3. ✅ slack-settings.tsx — uses Dialog for disconnect confirmation; differs from integration-card (custom panel vs action buttons)
4. ✅ fire-test-errors-card.tsx — posts to /api/admin/fire-test-errors; displays "Fired 1 random Sentry error"
5. ✅ types.ts (partial) — need full read

### Remaining for Explore Sub-agent
6. Find & read Sentry-specific component(s) under web/apps/dashboard/src
   - Look for *sentry* or *Sentry* files
   - Extract: trigger select JSX, setup modal copy, webhook URL generation, Client Secret input status
   
7. Read: web/apps/dashboard/src/lib/api/core-api-client.ts
   - Show interface signature + 2-3 integration-related methods
   
8. Read: web/apps/dashboard/src/lib/api/http-api-client.ts
   - Show interface + integration methods
   
9. Read: web/apps/dashboard/src/contexts/integrations/api/slack-oauth-handler.ts
   - 1-line description
   
10. Read: web/playwright.config.ts (verbatim, ~60 lines max)
    - Note baseURL handling, projects, env-based URL switching
    
11. List web/tests/e2e/dashboard/ and read specific tests:
    - settings-fire-test-errors.spec.ts (if exists)
    - any *integrations*, *sentry*, *slack* tests
    
12. Find & read auth setup: *.setup.ts, global-setup*
    - Show <40 lines, note env vars
    
13. web/CLAUDE.md — already provided in context summary
14. web/apps/dashboard/CLAUDE.md — already provided in context summary

15. Extract keys from web/apps/dashboard/.env.staging
    - `grep -E '^[A-Z_]+=' | cut -d= -f1`
    
16. web/apps/dashboard/package.json — show scripts object
17. web/package.json — show scripts object, e2e-related ones

18. Read web/apps/dashboard/src/contexts/integrations/domain/types.ts (full, not partial)
    - All Integration, SentryIntegration, IntegrationStatus, SentryTriggerType types

## Output Format
Sub-agent should return:
- File path as header
- Content (≤30 lines unless asked for more)
- Specific commentary per file
- Line numbers for key sections
- Final list of OPEN QUESTIONS

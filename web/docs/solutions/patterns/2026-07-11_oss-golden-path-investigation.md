# OSS dashboard golden path: triage, chat, root cause, remediation (AC-060)

## Problem

AC-060 requires the dashboard to drive a full investigation on a real Core
incident using the connected test application (AC-058) and configured LLM
(AC-059): analyses list/detail update, triage severity, model-backed incident
chat, root-cause hypothesis with evidence, and a remediation proposal.
Progress must be live from Core (SSE or documented polling). Playwright
fixtures and DeterministicLLMClient are not the pass path.

## Solution

1. Live-feed `sendGuidance` falls back to BFF
   `POST /api/investigation/:id/chat` → Core investigation chat when the
   worker WebSocket is unavailable, so chat returns model-backed replies.
2. Remediations section polls while the incident is live and refreshes on SSE
   `remediation.proposed` (`refreshKey`).
3. Stable `data-testid`s: `incident-severity`, `incident-root-cause`,
   `incident-root-cause-text`, `incident-remediations`, `incident-chat-*`.
4. Playwright `tests/oss/ac-060-golden-path.spec.ts` asserts the full loop
   against compose Core + Ornith (no `page.route` mocks of incidents APIs).

## Command

```bash
# Reuse healthy Core postgres/redis/hindsight; api+worker+test-app on :3099/:5190
# Ornith on :8081. Dashboard against host Core:
CORE_API_URL=http://127.0.0.1:3099 JWT_SECRET=oss-dev-jwt-secret-change-me \
  CAUSEFLOW_RUNTIME=oss pnpm --filter dashboard exec next dev --hostname 127.0.0.1 -p 5170

PLAYWRIGHT_OSS=1 SKIP_WEB_SERVER=1 OSS_DASHBOARD_URL=http://127.0.0.1:5170 \
  pnpm exec playwright test --project=dashboard-oss-e2e tests/oss/ac-060-golden-path.spec.ts
```

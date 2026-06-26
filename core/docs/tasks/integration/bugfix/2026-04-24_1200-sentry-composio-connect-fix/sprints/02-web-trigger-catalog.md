# Sprint 2 — Web: Add sentry/pagerduty/datadog/slack to TRIGGER_CATALOG

## Context

`integration-card.tsx` shows "Add Trigger" button only when `availableTriggers.length > 0`.
The web `TRIGGER_CATALOG` in `integration-catalog.ts` is missing entries for:
- `sentry` — should have `SENTRY_NEW_ISSUE`
- `pagerduty` — should have `PAGERDUTY_INCIDENT_TRIGGERED`
- `datadog` — should have `DATADOG_MONITOR_TRIGGERED`
- `slack` — should have `SLACK_RECEIVE_MESSAGE`

Core's `composio-trigger-service.ts` already has all four. Web catalog needs to match.

Bug B (camelCase param) is already fixed — `oauth-callback-handler.ts` correctly
reads `connectedAccountId` and calls `finalizeComposioConnection`. No changes needed there.

## Files to Modify

### `web/apps/dashboard/src/contexts/integrations/presentation/components/integration-catalog.ts`

Add to `TRIGGER_CATALOG`:
```typescript
sentry: [
  { slug: 'SENTRY_NEW_ISSUE', labelKey: 'triggers.sentry.new_issue' },
],
pagerduty: [
  { slug: 'PAGERDUTY_INCIDENT_TRIGGERED', labelKey: 'triggers.pagerduty.incident_triggered' },
],
datadog: [
  { slug: 'DATADOG_MONITOR_TRIGGERED', labelKey: 'triggers.datadog.monitor_triggered' },
],
slack: [
  { slug: 'SLACK_RECEIVE_MESSAGE', labelKey: 'triggers.slack.receive_message' },
],
```

### `web/apps/dashboard/src/contexts/integrations/infrastructure/i18n/en.json`

Add under `"triggers"` key (create if not exists):
```json
"triggers": {
  "sentry": { "new_issue": "New issue detected" },
  "pagerduty": { "incident_triggered": "Incident triggered" },
  "datadog": { "monitor_triggered": "Monitor alert triggered" },
  "slack": { "receive_message": "New message received" }
}
```

### `web/apps/dashboard/src/contexts/integrations/infrastructure/i18n/pt-br.json`

Same structure in Portuguese:
```json
"triggers": {
  "sentry": { "new_issue": "Novo problema detectado" },
  "pagerduty": { "incident_triggered": "Incidente disparado" },
  "datadog": { "monitor_triggered": "Alerta de monitor disparado" },
  "slack": { "receive_message": "Nova mensagem recebida" }
}
```

## Acceptance Criteria

- [ ] `TRIGGER_CATALOG` in `integration-catalog.ts` has entries for sentry, pagerduty, datadog, slack
- [ ] Slug values exactly match core's `composio-trigger-service.ts` catalog
- [ ] i18n keys exist in both en.json and pt-br.json
- [ ] `pnpm typecheck` clean (web)
- [ ] No biome lint errors on modified files

## Files Read-Only

- `web/apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx`
  (understand trigger rendering gate at `availableTriggers.length > 0`)
- `core/src/shared/infra/integrations/composio-trigger-service.ts`
  (source of truth for slug values)

## Important Notes

- Run biome lint as: `node_modules/.bin/biome check --write src/contexts/integrations/...` (NOT `pnpm exec biome`)
  because `pnpm exec biome` OOMs in PRoot ARM64 environment
- The `en.json` file has a pre-existing PEM key placeholder issue that was already fixed
  (value is "Paste your PEM private key here") — do not revert it
- Check for existing `"triggers"` key in i18n files before adding (may already exist)

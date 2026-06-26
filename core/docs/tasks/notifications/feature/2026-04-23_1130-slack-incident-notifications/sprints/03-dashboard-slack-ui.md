# Sprint 3: Dashboard — Slack Integration Card UI

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 3 of 3
- **Depends on:** None (API contract defined in PRD; Sprint 1 needed for staging E2E only)
- **Batch:** 1 (parallel with Sprint 1)
- **Model:** sonnet
- **Estimated effort:** S

## Objective

Add Slack OAuth connect button, connected state with editable channel input, Save, Test, and Disconnect actions to the Slack integration card on the Integrations page.

## File Boundaries

### Creates (new files)

- `web/apps/dashboard/src/contexts/integrations/presentation/components/slack-settings.tsx` — `SlackIntegrationSettings` component (connected + disconnected states)
- `web/apps/dashboard/src/contexts/integrations/api/slack-config-handler.ts` — Next.js API route handler for Slack config CRUD
- `web/apps/dashboard/src/app/api/integrations/slack/config/route.ts` — thin re-export for GET + PATCH
- `web/apps/dashboard/src/app/api/integrations/slack/oauth/route.ts` — thin re-export for OAuth start redirect
- `web/apps/dashboard/src/app/api/integrations/slack/test/route.ts` — thin re-export for POST /test
- `web/apps/dashboard/src/app/api/integrations/slack/disconnect/route.ts` — thin re-export for DELETE
- `web/apps/dashboard/src/contexts/integrations/api/__tests__/slack-config-handler.test.ts`

### Modifies (can touch)

- `web/apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx` — render `<SlackIntegrationSettings>` instead of default settings panel when `type === 'slack'` and Slack is connected
- `web/apps/dashboard/src/lib/api/http-api-client.ts` — add methods: `getSlackConfig()`, `updateSlackConfig(input)`, `deleteSlackOAuth()`, `testSlackConnection()`
- `web/apps/dashboard/src/lib/api/core-api-types.ts` — add `SlackConfigResponse`, `SlackConfigUpdateInput` types
- `web/apps/dashboard/src/contexts/integrations/infrastructure/i18n/pt-br.json` — add Slack settings translation keys
- `web/apps/dashboard/src/contexts/integrations/infrastructure/i18n/en.json` — add Slack settings translation keys

### Read-Only (reference but do NOT modify)

- `web/apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx` (read before modifying) — existing card render logic
- `web/apps/dashboard/src/contexts/settings/presentation/components/notifications-tab.tsx` — form pattern with save + toast feedback
- `web/apps/dashboard/src/contexts/shared/presentation/components/toast-provider.tsx` — toast API
- `web/apps/dashboard/src/contexts/integrations/api/oauth-callback-handler.ts` — existing OAuth callback pattern
- `web/apps/dashboard/CLAUDE.md` — mandatory patterns (thin route re-exports, implementation in contexts/)

### Shared Contracts (from PRD Section 12)

```typescript
// core-api-types.ts additions
export interface SlackConfigResponse {
  connected: boolean;
  channel?: string;           // #incidents
  workspaceName?: string;     // Acme Corp
  installedAt?: string;       // ISO 8601
}

export interface SlackConfigUpdateInput {
  channel: string;            // validated: ^#[a-z0-9_-]{1,79}$
}

// SlackIntegrationSettings component props
export interface SlackSettingsProps {
  config: SlackConfigResponse;
  onSave: (channel: string) => Promise<void>;
  onTest: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onConnect: () => void;  // redirect to OAuth
}
```

### Consumed Invariants

- All API routes must be thin re-exports; implementation in `contexts/integrations/api/`
- Toast feedback required on all save/test/disconnect actions
- i18n keys required for all user-visible strings (pt-BR + en)

## Tasks

- [ ] Add `SlackConfigResponse` + `SlackConfigUpdateInput` to `core-api-types.ts`
- [ ] Add HTTP client methods to `http-api-client.ts`:
  - `getSlackConfig(): Promise<SlackConfigResponse>` — GET `/v1/integrations/slack/config`
  - `updateSlackConfig(input: SlackConfigUpdateInput): Promise<SlackConfigResponse>` — PATCH `/v1/integrations/slack/config`
  - `deleteSlackOAuth(): Promise<void>` — DELETE `/v1/integrations/slack/oauth`
  - `testSlackConnection(): Promise<{ok:boolean,error?:string}>` — POST `/v1/integrations/slack/test`
- [ ] Create `slack-config-handler.ts` — Next.js handlers wrapping http-api-client calls (same pattern as `oauth-callback-handler.ts`):
  - `handleGetSlackConfig(req)` → GET
  - `handleUpdateSlackConfig(req)` → PATCH (parse + forward body)
  - `handleDeleteSlackOAuth(req)` → DELETE
  - `handleTestSlack(req)` → POST
- [ ] Create thin route files in `src/app/api/integrations/slack/`:
  - `config/route.ts` — GET + PATCH → `handleGetSlackConfig` / `handleUpdateSlackConfig`
  - `oauth/route.ts` — GET → redirect to `/v1/integrations/slack/oauth/authorize?returnUrl=<dashboard-integrations-url>`
  - `test/route.ts` — POST → `handleTestSlack`
  - `disconnect/route.ts` — DELETE → `handleDeleteSlackOAuth`
- [ ] Create `slack-settings.tsx` component with two render states:
  - **Disconnected:** "Add to Slack" button (links to `/api/integrations/slack/oauth`) with Slack logo
  - **Connected:** workspace name badge, channel input (`<Input placeholder="#incidents" />`), Save button, Test button, Disconnect link
  - Channel validation client-side: `^#[a-z0-9_-]{1,79}$` — inline error if invalid before saving
  - Save: calls `onSave(channel)` → success toast "Saved" | error toast with message
  - Test: calls `onTest()` → loading state → success toast "Test message sent" | error toast with `error` field
  - Disconnect: confirm dialog ("Disconnect Slack? Notifications will stop.") → calls `onDisconnect()` → success toast
- [ ] Integrate `<SlackIntegrationSettings>` into `integration-card.tsx`: when `type === 'slack'`, render this component below the standard connection state; pass config + handlers
- [ ] Add i18n keys to both `pt-br.json` and `en.json`:
  - `integrations.slack.connectButton` = "Add to Slack" / "Adicionar ao Slack"
  - `integrations.slack.connected` = "Connected to {workspace}" / "Conectado a {workspace}"
  - `integrations.slack.channelLabel` = "Notification Channel" / "Canal de Notificação"
  - `integrations.slack.channelPlaceholder` = "#incidents" / "#incidents"
  - `integrations.slack.channelError` = "Channel must start with # and contain only lowercase letters, numbers, hyphens, underscores" / "Canal deve começar com # e conter apenas letras minúsculas, números, hifens, sublinhados"
  - `integrations.slack.saveSuccess` = "Saved" / "Salvo"
  - `integrations.slack.testSuccess` = "Test message sent to {channel}" / "Mensagem de teste enviada para {channel}"
  - `integrations.slack.testFailed` = "Test failed: {error}" / "Teste falhou: {error}"
  - `integrations.slack.disconnectConfirm` = "Disconnect Slack? Notifications will stop." / "Desconectar Slack? As notificações serão interrompidas."
  - `integrations.slack.disconnectSuccess` = "Slack disconnected" / "Slack desconectado"
- [ ] Write unit test for `slack-config-handler.ts` (mock http-api-client, verify routing + error handling)

## Acceptance Criteria

- [ ] Slack integration card shows "Add to Slack" button when `connected:false`
- [ ] "Add to Slack" click redirects to `/api/integrations/slack/oauth` (no 404)
- [ ] Slack card shows workspace name + channel input when `connected:true`
- [ ] Channel input pre-filled from `config.channel`; invalid channel name (e.g. `incidents`) shows inline error before saving
- [ ] Save with valid channel → success toast; save with API error → error toast
- [ ] Test button shows loading state → success toast "Test message sent to #incidents" (mocked) or error toast
- [ ] Disconnect: confirm dialog appears → confirm → Disconnect API called → card resets to disconnected state → toast
- [ ] All strings use i18n keys (no hardcoded English/Portuguese strings in component)
- [ ] `pnpm typecheck` in `web/apps/dashboard/` passes
- [ ] `pnpm lint` passes in `web/`

## Verification

- [ ] `pnpm typecheck` in `web/apps/dashboard/`
- [ ] `pnpm lint` in `web/`
- [ ] `pnpm test -- --testPathPattern="slack"` in `web/apps/dashboard/`
- [ ] `pnpm dev` (local): navigate to `/dashboard/integrations` → Slack card visible with "Add to Slack" button → screenshot to `.artifacts/playwright/screenshots/YYYY-MM-DD_HHmm/slack-disconnected.png`
- [ ] Browser console + server console clean

## Context

### Dashboard Architecture Rules (from CLAUDE.md)

1. Route files under `src/app/api/` are thin re-exports only — no logic
2. Implementation lives in `src/contexts/<context>/api/<handler>.ts`
3. All core API calls go through `http-api-client.ts` with Clerk Bearer token
4. Components use `@causeflow/ui/primitives` for Input, Button, Dialog, Badge

### integration-card.tsx Integration Point

The card already renders custom content per `type`. Find the section that renders per-type settings (after the connection status area) and add:
```tsx
{type === 'slack' && (
  <SlackIntegrationSettings
    config={slackConfig}
    onSave={handleSaveSlackConfig}
    onTest={handleTestSlack}
    onDisconnect={handleDisconnectSlack}
    onConnect={handleConnectSlack}
  />
)}
```

The parent (`integrations-client.tsx`) needs to fetch `slackConfig` via `getSlackConfig()` on mount and wire the handlers.

### OAuth Redirect Flow

`/api/integrations/slack/oauth` (GET) → redirect to `/v1/integrations/slack/oauth/authorize?returnUrl=<encoded-dashboard-url>`. After OAuth, Slack redirects to core callback, which redirects back to `returnUrl?slack=connected`. Dashboard should detect `?slack=connected` query param and reload the Slack config.

### Notifications-Tab Pattern Reference

`notifications-tab.tsx` shows the exact form pattern to follow:
- `useState` for local channel value
- `isLoading` state for save/test buttons
- `addToast()` for feedback
- Handle async errors inline

## Agent Notes (filled during execution)

- Assigned to:
- Started:
- Completed:
- Decisions made:
- Assumptions:
- Issues found:

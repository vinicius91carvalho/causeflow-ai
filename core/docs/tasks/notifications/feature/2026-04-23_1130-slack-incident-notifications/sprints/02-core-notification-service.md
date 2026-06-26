# Sprint 2: Core — Notification Service + Event Subscribers

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 2 of 3
- **Depends on:** Sprint 1 (TenantSettings.slackConfig shape, `@slack/web-api` added)
- **Batch:** 2 (sequential after Sprint 1)
- **Model:** sonnet
- **Estimated effort:** M

## Objective

Implement `SlackChatPlatform` adapter, rich Slack block formatters, dedup-aware notification service, and EventBus subscribers that post incident alerts and investigation resolutions to Slack automatically.

## File Boundaries

### Creates (new files)

- `core/src/shared/infra/chat/slack-chat-platform.ts` — `ChatPlatform` adapter using `@slack/web-api` WebClient
- `core/src/shared/infra/chat/slack-message-formatter.ts` — builds `SlackIncidentBlocks` and `SlackResolutionBlocks`
- `core/src/shared/application/subscribers/slack-notification.subscriber.ts` — EventBus handlers for `incident.created` + `investigation.completed`
- `core/tests/unit/infra/chat/slack-chat-platform.test.ts`
- `core/tests/unit/infra/chat/slack-message-formatter.test.ts`
- `core/tests/unit/application/subscribers/slack-notification.subscriber.test.ts`

### Modifies (can touch)

- `core/src/bootstrap.ts` — subscribe `SlackNotificationSubscriber` to `incident.created` and `investigation.completed` events; instantiate `SlackChatPlatform`
- `core/package.json` — add `"@slack/web-api": "^7.14.1"` to dependencies
- `core/src/modules/integration/infra/slack.routes.ts` — wire `POST /test` using `SlackChatPlatform.testConnection()`
- `core/src/modules/ingestion/domain/incident.entity.ts` — add optional `slackNotificationTs?: string` field (message timestamp for threading)
- `core/src/modules/ingestion/infra/dynamo-incident.repository.ts` — persist/read `slackNotificationTs`

### Read-Only (reference but do NOT modify)

- `core/src/shared/domain/events.ts` — event type definitions and EventBus API
- `core/src/shared/application/ports/chat-platform.port.ts` — ChatPlatform interface to implement
- `core/src/shared/infra/chat/web-portal-chat-platform.ts` — reference adapter implementation
- `core/src/modules/integration/infra/slack-notification.repository.ts` — dedup table (created in Sprint 1)
- `core/src/modules/tenant/domain/tenant.entity.ts` — SlackConfig type (Sprint 1 output)
- `core/src/modules/investigation/application/investigate-incident.usecase.ts` — investigation.completed payload shape (lines 1088-1108)
- `core/src/modules/ingestion/application/ingest-alert.usecase.ts` — incident.created payload shape (lines 48-52)
- `core/src/shared/domain/types.ts` — Severity enum

### Shared Contracts (from PRD Section 12 — consumed here)

```typescript
// SlackIncidentBlocks input
type SlackIncidentBlocksInput = {
  severity: Severity;         // 'critical' | 'high'
  title: string;
  service: string;
  environment: string;
  triageSummary?: string;     // First 120 chars of AI finding
  investigationUrl: string;   // https://app.causeflow.io/investigations/{id}
  triggeredAt: string;        // ISO 8601
}

// SlackResolutionBlocks input
type SlackResolutionBlocksInput = {
  incidentTitle: string;
  rootCause: string;          // First 200 chars
  recommendedActions: string[]; // Top 2
  durationMs: number;
  reportUrl: string;
}
```

### Consumed Invariants

- Severity filter: subscriber fires ONLY for `critical` | `high` — guard in subscriber, never in formatter
- Token never logged: `accessToken` + `webhookUrl` must never appear in `logger.*()` calls in slack-chat-platform.ts
- Dedup before post: call `slackNotificationRepo.findNotification(tenantId, incidentId, 'alert')` before calling `chat.postMessage` — skip if exists

## Tasks

- [ ] Add `@slack/web-api` to `core/package.json` dependencies
- [ ] Create `slack-message-formatter.ts`:
  - `formatIncidentBlocks(input: SlackIncidentBlocksInput): KnownBlock[]` — severity color bar (red=critical, orange=high), header with emoji, service/env fields, triage summary section, "View Investigation" button
  - `formatResolutionBlocks(input: SlackResolutionBlocksInput): KnownBlock[]` — green checkmark header, root cause section, top-2 recommended actions, duration, "View Full Report" button
  - Severity emoji map: `critical` → 🔴, `high` → 🟠
- [ ] Create `slack-chat-platform.ts` implementing `ChatPlatform`:
  - Constructor takes `WebClient` (from `@slack/web-api`) + `slackNotificationRepo`
  - `sendMessage(msg: ChatMessage): Promise<{messageId, threadId}>` — calls `client.chat.postMessage({channel, blocks, thread_ts?})`, saves `ts` to dedup table
  - `testConnection(): Promise<boolean>` — calls `client.auth.test()`, returns true/false
  - Never log `accessToken`, `webhookUrl`, webhook URL (only log `channel`, `incidentId`, result status)
- [ ] Create `slack-notification.subscriber.ts`:
  - `onIncidentCreated(event: IncidentCreatedEvent)`: 
    1. Check `severity` ∈ `['critical','high']` — return early otherwise
    2. Load tenant slackConfig via tenant repo — return early + log `slack.notification.skipped reason=not_configured` if absent
    3. Dedup check: `slackNotificationRepo.findNotification(tenantId, incidentId, 'alert')` — skip if exists
    4. Load incident details (title, service, environment) from incident repo
    5. Format blocks via `formatIncidentBlocks`
    6. Post via `new WebClient(slackConfig.accessToken).chat.postMessage({channel: slackConfig.channelId, blocks})`
    7. Save `{tenantId, incidentId, type:'alert', messageTs: result.ts, channel, postedAt}` to dedup table
    8. Update investigation entity `slackNotificationTs = result.ts` if investigation exists
    9. On error: log `slack.notification.failed incidentId=xxx error=yyy` — do NOT throw
  - `onInvestigationCompleted(event: InvestigationCompletedEvent)`:
    1. Load tenant slackConfig — skip + log if absent
    2. Dedup check for `type:'resolution'`
    3. Look up `slackNotificationTs` from investigation entity (for threading)
    4. Format resolution blocks via `formatResolutionBlocks`
    5. Post via `chat.postMessage({channel, blocks, thread_ts: slackNotificationTs})` — thread if ts available, post standalone if not
    6. Save to dedup table with `type:'resolution'`
    7. On error: log + continue
- [ ] Wire in `bootstrap.ts`:
  - Instantiate `SlackChatPlatform` with `WebClient` (no-op client when `!config.slack.clientId`)
  - Subscribe `subscriber.onIncidentCreated` to `incident.created`
  - Subscribe `subscriber.onInvestigationCompleted` to `investigation.completed`
- [ ] Wire `POST /test` in `slack.routes.ts` — instantiate WebClient from tenant slackConfig, call `client.auth.test()`, return `{ok:true}` or `{error:message}`
- [ ] Write unit tests for formatter (verify block structure, emoji map, truncation), platform (mock WebClient, verify no-token-in-logs, dedup skip), subscriber (mock repos, verify severity filter, dedup, error isolation)
- [ ] **Security (mandatory per spec Sec 10):**
  - Severity filter: guard at top of `onIncidentCreated` — `if (!['critical','high'].includes(severity)) return;`
  - Dedup before every post: check `slackNotificationRepo.findNotification` BEFORE calling `chat.postMessage` — skip if record exists
  - Logging restriction: `accessToken` and `webhookUrl` must never appear in any logger call in `slack-chat-platform.ts` — add grep assertion to unit test
  - Error isolation: wrap entire handler bodies in try/catch — catch logs `{incidentId, error.message}` and returns (never re-throws)

## Acceptance Criteria

- [ ] `incident.created` event with `severity:'critical'` AND valid slackConfig → `chat.postMessage` called with correct channel and blocks containing severity, title, service, link
- [ ] `incident.created` event with `severity:'medium'` → `chat.postMessage` NOT called
- [ ] `investigation.completed` event → reply posted in thread of incident message (`thread_ts` set)
- [ ] Duplicate `incident.created` for same incidentId → second call skipped (dedup table hit)
- [ ] `chat.postMessage` error (e.g. `channel_not_found`) → error logged, no exception thrown, incident pipeline continues
- [ ] `POST /v1/integrations/slack/test` → `{ok:true}` when `client.auth.test()` succeeds
- [ ] No `accessToken` or `webhookUrl` appears in any log output (grep test)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test -- --testPathPattern="slack"` all pass

## Verification

- [ ] `pnpm typecheck` in `core/`
- [ ] `pnpm lint` in `core/`
- [ ] `pnpm test:run tests/unit/infra/chat/ tests/unit/application/subscribers/` all pass
- [ ] `grep -rn "accessToken\|webhookUrl" core/src/shared/infra/chat/slack-chat-platform.ts | grep -v "//" | grep "log\|console\|logger"` → returns empty

## Context

### ChatPlatform Interface (from `chat-platform.port.ts`)

```typescript
interface ChatPlatform {
  sendMessage(msg: ChatMessage): Promise<{ messageId: string; threadId?: string }>;
  requestApproval(req: ApprovalRequest): Promise<ApprovalResponse>;
  updateMessage(channelId: string, messageId: string, text: string): Promise<void>;
  testConnection(): Promise<boolean>;
}

interface ChatMessage {
  channelId: string;
  text?: string;
  blocks?: KnownBlock[];
  threadId?: string;
}
```

### Slack Block Structure — Incident

```javascript
[
  { type: "header", text: { type: "plain_text", text: "🔴 CRITICAL Incident" } },
  {
    type: "section",
    text: { type: "mrkdwn", text: "*NullPointerException in checkout flow*\n_payment-service • production_" }
  },
  {
    type: "section",
    fields: [
      { type: "mrkdwn", text: "*Severity:*\nCritical" },
      { type: "mrkdwn", text: "*Service:*\npayment-service" },
      { type: "mrkdwn", text: "*Environment:*\nproduction" },
      { type: "mrkdwn", text: "*Triggered:*\n2 min ago" }
    ]
  },
  {
    type: "section",
    text: { type: "mrkdwn", text: "*AI Triage:* High confidence DB connection pool exhaustion." }
  },
  {
    type: "actions",
    elements: [
      { type: "button", text: { type: "plain_text", text: "View Investigation →" },
        url: "https://app.causeflow.io/investigations/123", action_id: "view_investigation" }
    ]
  }
]
```

### investigation.completed Event Payload

```typescript
// From investigate-incident.usecase.ts:1094-1108
{
  eventType: 'investigation.completed',
  tenantId: string,
  payload: {
    incidentId: string,
    rootCause: string,
    agentsUsed: string[],
    recommendedActions: StructuredAction[],  // .description field
    totalCostUsd: number,
    investigationDurationMs: number
  }
}
```

### EventBus Subscription Pattern

```typescript
// bootstrap.ts pattern (line ~907)
eventBus.subscribe('incident.created', async (event) => {
  await slackNotificationSubscriber.onIncidentCreated(event);
});
eventBus.subscribe('investigation.completed', async (event) => {
  await slackNotificationSubscriber.onInvestigationCompleted(event);
});
```

### Error Isolation Pattern

Wrap entire subscriber handler in try/catch. On any error: `logger.error({incidentId, error: err.message}, 'slack.notification.failed')`. Never re-throw. EventBus uses `Promise.allSettled` already, but belt-and-suspenders.

## Agent Notes (filled during execution)

- Assigned to:
- Started:
- Completed:
- Decisions made:
- Assumptions:
- Issues found:

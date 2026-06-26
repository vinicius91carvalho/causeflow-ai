# Slack Incident Notifications: Product Requirements Document

## 1. What & Why

**Problem:** When a high or critical incident is investigated by CauseFlow AI, on-call engineers have no real-time awareness unless they're actively watching the dashboard. Investigation completions and resolutions are also invisible to the broader team.

**Desired Outcome:** CauseFlow AI automatically posts a rich Slack message when a high/critical incident is detected, and replies in the same thread when the investigation completes — with root cause, recommended actions, and a link to the full report.

**Justification:** On-call visibility is table-stakes for an incident management tool. Slack is where teams already coordinate. This unblocks user activation for teams that monitor via Slack.

---

## 2. Correctness Contract

**Audience:** On-call engineers, SREs, tech leads — they see the notification and decide whether to act immediately or wait for the AI investigation to finish.

**Failure Definition:** Missing notification (incident fired but no Slack message), notification with wrong data (wrong severity/service), broken link to investigation, resolution posted without linking back to incident thread.

**Danger Definition:** Spam (same incident posted multiple times), notifications for low/medium severity (alert fatigue), leaking Slack bot token in logs, posting to wrong tenant's channel.

**Risk Tolerance:** Missing notification is worse than a delayed one. If unsure whether to post, post. If unsure of channel, stop and log error — do NOT guess channel.

**Uncertainty Policy:** Flag — log assumption with incident ID if Slack config absent. Stop on auth errors (don't retry with bad token).

---

## 3. Context Loaded

- `core/src/shared/domain/types.ts`: `Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'`. Threshold: severity rank ≤ `minInvestigationSeverity` (default `high`) triggers investigation.
- `core/src/shared/domain/events.ts`: EventBus in-process pub/sub. Key events: `incident.created` (payload: `{incidentId,severity,title}`) and `investigation.completed` (payload: `{incidentId,rootCause,agentsUsed}`).
- `core/src/bootstrap.ts`: EventBus subscribers wired here (lines 680–950+). Perfect injection point for Slack notification subscriber.
- `core/src/modules/tenant/domain/tenant.entity.ts`: `TenantSettings` has `notificationChannels: string[]` and `chatProvider`. Extend with `slackConfig`.
- `core/src/modules/tenant/application/update-tenant.usecase.ts`: Update flow for tenant settings.
- `core/src/shared/application/ports/chat-platform.port.ts`: `ChatPlatform` interface (sendMessage, requestApproval, updateMessage). Slack adapter implements this.
- `core/src/shared/infra/chat/web-portal-chat-platform.ts`: Reference adapter implementation.
- `core/src/modules/investigation/application/investigate-incident.usecase.ts:1094`: Publishes `investigation.completed` with `{rootCause, recommendedActions, proposedFix, totalCostUsd}`.
- `web/apps/dashboard/src/contexts/integrations/presentation/components/integration-card.tsx`: Existing integration card. Slack card rendered here. No per-integration settings panel today.
- `web/apps/dashboard/src/lib/api/http-api-client.ts`: Core API client used by all dashboard→core calls.
- `@slack/web-api` v7.14.1 in node_modules (not yet in package.json dependencies).

---

## 4. Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Time from incident creation to Slack notification | ∞ (no notification) | < 30 s | CloudWatch: `incident.created` timestamp vs `slack.notification.sent` log |
| Slack install completion rate | 0% | > 60% of active tenants | DB count `tenants WHERE slackConfig IS NOT NULL` |
| Resolution notification delivery rate | 0% | > 95% when webhook configured | `slack.resolution.sent` vs `investigation.completed` events count |
| Duplicate notifications per incident | N/A | 0 | DB unique constraint on `(incidentId, notificationType)` |

---

## 5. User Stories

**S1 — Incident alert:**
GIVEN a workspace has Slack configured with a webhook + channel
WHEN an incident with severity `high` or `critical` is ingested
THEN a rich Slack message is posted to the configured channel within 30 s with: severity emoji, title, service, environment, AI triage summary, and link to investigation

**S2 — Resolution thread:**
GIVEN an incident Slack notification was posted (S1)
WHEN the CauseFlow AI investigation completes
THEN a reply is posted in the same thread with: root cause, recommended actions summary, cost, duration, and link to full report

**S3 — No channel configured:**
GIVEN a workspace has NOT configured Slack
WHEN a high/critical incident is ingested
THEN no Slack message is sent; a structured log entry `slack.notification.skipped reason=not_configured incidentId=xxx` is emitted

**S4 — Channel config via dashboard:**
GIVEN a workspace has connected Slack via OAuth
WHEN the user views the Slack integration card
THEN they see: workspace name, channel (pre-filled from OAuth), Save and Test buttons

**S5 — Test button:**
GIVEN Slack is connected
WHEN user clicks "Test"
THEN a test message is posted to the configured channel within 5 s; success/error shown as toast

---

## 6. Acceptance Criteria

- [ ] `POST /v1/integrations/slack/oauth/authorize` redirects to Slack OAuth consent page with scopes `incoming-webhook,chat:write,channels:read`
- [ ] `GET /v1/integrations/slack/oauth/callback` exchanges code → stores `{webhookUrl, channel, channelId, workspaceId, workspaceName, accessToken, installedAt}` in tenant slackConfig
- [ ] `GET /v1/integrations/slack/config` returns `{connected:true, channel, workspaceName, installedAt}` — NO token exposed
- [ ] `PATCH /v1/integrations/slack/config` accepts `{channel:string}` and updates stored channel
- [ ] `DELETE /v1/integrations/slack/oauth` removes slackConfig and clears stored token
- [ ] `POST /v1/integrations/slack/test` posts a test message to configured channel; returns `200 {ok:true}` or `400 {error:string}`
- [ ] `incident.created` subscriber fires when severity is `high` or `critical` AND `slackConfig.webhookUrl` present; posts incident notification within 30 s
- [ ] `investigation.completed` subscriber fires when incident has `slackNotificationTs` stored; posts resolution in thread
- [ ] Slack blocks contain all required fields: severity, title, service, environment, link to investigation page
- [ ] Resolution blocks contain: root cause, top 2 recommended actions, duration, link to full report
- [ ] No duplicate notifications: `slack_notification` table has unique constraint `(incidentId, type)`
- [ ] Dashboard Slack card shows "Add to Slack" button when disconnected; connected state shows workspace, channel input, Save, Test, Disconnect
- [ ] Test button shows success/error toast
- [ ] All Slack config UI text has pt-BR + en translations

---

## 7. Non-Goals

- **Threading via incoming webhook only** — excluded because webhooks don't return `ts`; we need `chat.postMessage` for thread replies.
- **Slack slash commands / interactivity** — excluded to keep scope bounded; approvals already handled via web portal.
- **Per-incident channel override** — excluded; one channel per workspace for MVP.
- **Composio Slack actions for notifications** — excluded per user decision; Composio posts as user OAuth token, not as CauseFlow bot.
- **Slack channel picker dropdown** — excluded; free-text channel name input only for MVP.
- **Notification for medium/low/info severity** — excluded to prevent alert fatigue.
- **Email notification changes** — excluded; out of scope.

---

## 8. Technical Constraints

- **Stack:** TypeScript, Hono (core), Next.js 15 (dashboard), `@slack/web-api` v7.x, AWS CDK (infra)
- **Secrets:** `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI` stored in AWS Secrets Manager (`causeflow-stack.ts`) — never in env files committed to git
- **Tenant isolation:** Slack config stored per-tenant in `TenantSettings.slackConfig`; access token encrypted at rest (existing KMS pattern from other secrets)
- **No new queue** — use existing EventBus; notification is best-effort (not durable). If Slack is down, log error and continue — do not block incident pipeline.
- **Rate limits:** Slack webhook rate limit = 1 msg/s; investigation.completed is low frequency, no concern for MVP
- **`@slack/web-api` dependency** — add to `core/package.json`; already in node_modules

---

## 9. Architecture Decisions

| Decision | Reversal Cost | Alternatives Considered | Rationale |
|----------|--------------|------------------------|-----------|
| OAuth Slack App (not Incoming Webhook only) | Medium | Incoming Webhook URL pasted by user | OAuth provides bot token enabling `chat.postMessage` → `ts` for threading. User-pasted webhook would require no OAuth flow but loses threading + validation. |
| Store `accessToken` + use `chat.postMessage` (not just webhook) | Low | Webhook-only (no threading) | Threading is table-stakes for resolution → incident linkage. Token stored encrypted per existing pattern. |
| Best-effort notification (not durable queue) | Low | SQS queue for notifications | Investigation pipeline must not fail if Slack is down. EventBus already in-process; adding SQS would be overengineering for MVP. |
| `slack_notification` dedup table | Low | No dedup | EventBus may fire duplicate events on restarts; dedup table prevents double-posts. |
| Slack adapter implements `ChatPlatform` port | Medium | Ad-hoc service class | Existing port fits perfectly; keeps infra consistent and enables future Teams/Discord adapters. |

---

## 10. Security Boundaries

- **Auth model:** Slack OAuth endpoints require authenticated Clerk JWT (tenant context). Callback uses `state` param (CSRF protection — signed HMAC with `SLACK_STATE_SECRET`).
- **Trust boundaries:** `code` from Slack OAuth callback is untrusted user input — exchange server-side only, never log. `channel` from user input is validated: must match `^#[a-z0-9_-]{1,79}$`.
- **Data sensitivity:** `accessToken` (Slack bot token `xoxb-...`) stored encrypted in DynamoDB using existing KMS key. Never returned in API responses. `webhookUrl` treated as secret (contains signing key in URL).
- **Tenant isolation:** All Slack API calls look up `slackConfig` from authenticated tenant's settings. No cross-tenant config access possible via route params.
- **Logging:** Log `incidentId`, `channel`, `timestamp` — NEVER log `accessToken`, `webhookUrl`, or webhook response body.

---

## 11. Data Model

**Access Patterns:**
1. On incident created: look up tenant's `slackConfig.webhookUrl` + `channel` + `accessToken` (per-tenant, by tenantId, < 10ms)
2. On investigation completed: look up `slackNotificationTs` for incident (by tenantId + incidentId — tenantId always in scope from event payload, < 10ms)
3. Dedup check: read `slack_notification (incidentId, type)` before posting (by incidentId + type)
4. Dashboard: read/write `slackConfig` per tenant settings PATCH

**Entities:**

`TenantSettings.slackConfig` (added to existing JSON field in tenant entity):
```typescript
slackConfig?: {
  webhookUrl: string;         // Slack incoming webhook URL (encrypted)
  channel: string;            // e.g. #incidents
  channelId: string;          // Slack channel ID C1234567
  workspaceId: string;        // Slack team ID T1234567
  workspaceName: string;      // e.g. "Acme Corp"
  accessToken: string;        // xoxb-... bot token (encrypted)
  installedAt: string;        // ISO 8601
  configurationUrl?: string;  // Slack app config URL
}
```

`SlackNotification` (new DynamoDB table `slack-notifications`):
```typescript
{
  pk: `TENANT#${tenantId}`,
  sk: `INCIDENT#${incidentId}#TYPE#${type}`,  // type: 'alert' | 'resolution'
  messageTs: string,           // Slack message timestamp (for threading)
  channel: string,
  postedAt: string,
  ttl: number                  // 30 days
}
```

**Schema justification:** Tenant settings JSON is already the config store for per-tenant preferences. `slack-notifications` DynamoDB table uses same PK pattern as other tables. TTL prevents unbounded growth.

---

## 12. Shared Contracts

**API contracts** (Sprint 1 core → Sprint 3 dashboard):

```typescript
// GET /v1/integrations/slack/config
SlackConfigResponse = {
  connected: boolean;
  channel?: string;           // #incidents
  workspaceName?: string;     // Acme Corp
  installedAt?: string;       // ISO 8601
}

// PATCH /v1/integrations/slack/config
SlackConfigUpdateInput = {
  channel: string;            // must match ^#[a-z0-9_-]{1,79}$
}

// POST /v1/integrations/slack/oauth/authorize (redirect, no body)
// Query: ?returnUrl=<dashboard-url>
// Redirect → Slack OAuth page

// GET /v1/integrations/slack/oauth/callback (Slack redirects here)
// Stores config, redirects → returnUrl?slack=connected

// DELETE /v1/integrations/slack/oauth
// 204 on success

// POST /v1/integrations/slack/test
// 200 { ok: true } | 400 { error: string }
```

**Slack blocks format** (Sprint 2 core formatter → used by notification service):

```typescript
type SlackIncidentBlocks = {
  severity: Severity;
  title: string;
  service: string;
  environment: string;
  triageSummary?: string;     // First ~120 chars of AI triage finding
  investigationUrl: string;   // https://app.causeflow.io/investigations/{id}
  triggeredAt: string;        // ISO 8601
}

type SlackResolutionBlocks = {
  incidentTitle: string;
  rootCause: string;          // First 200 chars
  recommendedActions: string[]; // Top 2
  durationMs: number;
  reportUrl: string;          // https://app.causeflow.io/investigations/{id}
}
```

**Dashboard component contract** (Sprint 3):
```typescript
// Props for SlackIntegrationSettings component
type SlackSettingsProps = {
  config: SlackConfigResponse;
  onSave: (channel: string) => Promise<void>;
  onTest: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onConnect: () => void; // redirects to OAuth
}
```

---

## 13. Architecture Invariant Registry

| Concept | Owner | Format/Values | Verify Command |
|---------|-------|---------------|----------------|
| Slack severity filter | `SlackNotificationSubscriber` | Only `critical` \| `high` trigger notifications | `grep -n "slackSeverityFilter\|severity.*slack" core/src/bootstrap.ts` |
| Slack token never logged | `SlackChatPlatform` | `accessToken` and `webhookUrl` must not appear in log statements | `grep -rn "accessToken\|webhookUrl" core/src/shared/infra/chat/slack-chat-platform.ts \| grep -v "\/\/" \| grep "log\|console\|logger"` → must return empty |
| Dedup before post | `SlackNotificationService` | Every `postIncidentAlert` checks `slack_notification` table before posting | `grep -n "findNotification\|dedup\|slack_notification" core/src/shared/infra/chat/slack-notification-service.ts` |
| Channel validation | API layer | Channel must match `^#[a-z0-9_-]{1,79}$` before storage | `grep -n "channelRegex\|channel.*validate" core/src/modules/integration/infra/slack.routes.ts` |

---

## 14. Open Questions

- [x] **Slack auth approach:** OAuth Slack App install (user confirmed)
- [x] **Message format:** Rich Slack blocks (user confirmed)
- [x] **UI location:** Slack integration card on Integrations page (user confirmed)
- [x] **Composio vs dedicated app:** Dedicated Slack app (user confirmed)
- [ ] **`APP_BASE_URL` for `SLACK_REDIRECT_URI`:** confirm staging + production values before Sprint 1 (must match what's registered in Slack app settings at api.slack.com)
- [ ] **Slack app registration:** Dev team must create app at api.slack.com, configure OAuth redirect URLs, get `SLACK_CLIENT_ID` + `SLACK_CLIENT_SECRET`, enable `incoming-webhook`, `chat:write`, `channels:read` scopes. Prereq for Sprint 1 staging test.

---

## 15. Uncertainty Policy

When uncertain about Slack API behavior: Flag — add a comment with assumption + log at `debug` level. Continue.
When `slackConfig` absent on incident: Log `slack.notification.skipped reason=not_configured` and continue — do not throw.
When Slack API returns error: Log error with `incidentId` (no token/URL), emit metric `slack.notification.failed`, continue — never block incident pipeline.

---

## 16. Verification

**Deterministic:**
- `pnpm typecheck` passes in `core/` and `web/apps/dashboard/`
- `pnpm test` unit tests pass (SlackChatPlatform, SlackNotificationService, formatters)
- `pnpm lint` clean

**Staging integration:**
- `POST /v1/integrations/slack/oauth/authorize` redirects to `slack.com/oauth/v2/authorize`
- `GET /v1/integrations/slack/config` returns `{connected:true, channel:"#incidents"}` after OAuth
- `POST /v1/integrations/slack/test` posts test message to configured channel within 5 s
- Trigger test incident (severity `critical`) → Slack message in channel within 30 s
- Complete investigation → reply in thread of incident message

**Manual:**
- Dashboard: Slack card shows "Not connected" → "Add to Slack" → OAuth flow → "Connected" + channel input
- Channel input: save → success toast. Invalid channel name → inline error.
- Disconnect → card returns to "Not connected" state.

---

## 17. Sprint Decomposition

| Sprint | Title | Depends On | Batch | Model | Parallel With |
|--------|-------|-----------|-------|-------|---------------|
| 1 | Core — Slack OAuth + config API | None | 1 | sonnet | Sprint 3 |
| 2 | Core — Notification service + event subscribers | Sprint 1 | 2 | sonnet | — |
| 3 | Dashboard — Slack integration card UI | None | 1 | sonnet | Sprint 1 |

### Sprint 1: Core Slack OAuth + Config API → `sprints/01-core-slack-oauth.md`

**Objective:** Implement Slack OAuth flow + credential storage + config CRUD endpoints so tenants can connect their Slack workspace.
**Estimated effort:** M
**Dependencies:** None

### Sprint 2: Core Notification Service + Event Subscribers → `sprints/02-core-notification-service.md`

**Objective:** Implement `SlackChatPlatform` adapter, rich block formatters, dedup table, and EventBus subscribers that post incident alerts and investigation resolutions to Slack.
**Estimated effort:** M
**Dependencies:** Sprint 1 (TenantSettings.slackConfig shape, `@slack/web-api` dependency)

### Sprint 3: Dashboard Slack Integration Card UI → `sprints/03-dashboard-slack-ui.md`

**Objective:** Add OAuth connect button, connected state with channel input, Save, Test, and Disconnect to the Slack integration card.
**Estimated effort:** S
**Dependencies:** None (uses API contract from PRD Section 12; Sprint 1 needed for staging test only)

---

## 18. Execution Log

*Filled during execution — tracked in progress.json*

---

## 19. Learnings

*Filled after all sprints complete*

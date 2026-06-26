# INVARIANTS — Slack Incident Notifications

## Slack Severity Filter

- **Owner:** `core/src/shared/application/subscribers/slack-notification.subscriber.ts`
- **Preconditions:** Caller must pass the raw `incident.created` event without pre-filtering
- **Postconditions:** `chat.postMessage` is ONLY called when `severity` is `critical` or `high`
- **Invariants:** Medium, low, info severity incidents never trigger Slack notifications
- **Verify:** `grep -n "onIncidentCreated\|severity" core/src/shared/application/subscribers/slack-notification.subscriber.ts | grep -E "critical|high"` → must show filter guard
- **Fix:** Add `if (!['critical','high'].includes(event.payload.severity)) return;` at top of `onIncidentCreated`

## Slack Token Never Logged

- **Owner:** `core/src/shared/infra/chat/slack-chat-platform.ts`
- **Preconditions:** Any code handling `SlackConfig` must not pass `accessToken` or `webhookUrl` to logger
- **Postconditions:** Log output contains only `channel`, `incidentId`, `messageTs`, status strings
- **Invariants:** `accessToken` and `webhookUrl` must never appear in log calls (even at debug level)
- **Verify:** `grep -rn "accessToken\|webhookUrl" core/src/shared/infra/chat/slack-chat-platform.ts | grep -v "//" | grep "log\|console\|logger"` → must return empty
- **Fix:** Remove sensitive field from log call; log only `{incidentId, channel, status}` subset

## Dedup Before Slack Post

- **Owner:** `core/src/shared/application/subscribers/slack-notification.subscriber.ts`
- **Preconditions:** `slack-notification.repository.ts` must be wired and reachable from subscriber
- **Postconditions:** Same `(tenantId, incidentId, type)` combination never results in two Slack messages
- **Invariants:** `findNotification(tenantId, incidentId, type)` is called before every `chat.postMessage` call; call is skipped if result is non-null
- **Verify:** `grep -n "findNotification\|dedup" core/src/shared/application/subscribers/slack-notification.subscriber.ts` → must show call before postMessage
- **Fix:** Add dedup check before posting; save record after successful post

## Channel Format Validation

- **Owner:** API layer — `core/src/modules/integration/infra/slack.routes.ts`
- **Preconditions:** `channel` field from user input arrives as string
- **Postconditions:** Only channels matching `^#[a-z0-9_-]{1,79}$` are stored; invalid input returns HTTP 400
- **Invariants:** No channel value stored in `slackConfig` may contain uppercase, spaces, or be missing the `#` prefix
- **Verify:** `grep -n "channelRegex\|#\[a-z\]" core/src/modules/integration/infra/slack.routes.ts` → must show regex validation
- **Fix:** Add validation middleware or inline regex check before `UpdateSlackConfigUseCase.execute()`

## Notification Error Isolation

- **Owner:** `core/src/shared/application/subscribers/slack-notification.subscriber.ts`
- **Preconditions:** Subscriber is registered on EventBus via `eventBus.subscribe()`
- **Postconditions:** Any Slack API error does NOT propagate out of the subscriber; incident pipeline continues
- **Invariants:** Every `onIncidentCreated` and `onInvestigationCompleted` method wraps its body in try/catch; catch block logs and returns (never re-throws)
- **Verify:** `grep -n "try\|catch\|throw" core/src/shared/application/subscribers/slack-notification.subscriber.ts` → must show try/catch with no re-throw in catch
- **Fix:** Wrap handler body in `try { ... } catch(err) { logger.error({incidentId, error: err.message}, 'slack.notification.failed'); }`

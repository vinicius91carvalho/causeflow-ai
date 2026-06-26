# OAuth Dev Setup — Project Integrations

Guide to set up OAuth credentials for Notion, Shortcut, and Trello integrations in development.

## Environment Variables

Add to your `.env` file:

```env
OAUTH_CALLBACK_BASE_URL=http://localhost:3000

# Notion
OAUTH_NOTION_CLIENT_ID=<your-notion-client-id>
OAUTH_NOTION_CLIENT_SECRET=<your-notion-client-secret>

# Trello
OAUTH_TRELLO_CLIENT_ID=<your-trello-api-key>
OAUTH_TRELLO_CLIENT_SECRET=<your-trello-api-secret>

# Shortcut
OAUTH_SHORTCUT_CLIENT_ID=<your-shortcut-client-id>
OAUTH_SHORTCUT_CLIENT_SECRET=<your-shortcut-client-secret>
```

---

## Notion Setup

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **"New integration"**
3. Name: `CauseFlow Dev`
4. Type: **Public** (required for OAuth)
5. Redirect URI: `http://localhost:3000/v1/integrations/oauth/notion/callback`
6. Capabilities: **Read content**, **Read user information**
7. Copy the **OAuth client ID** and **OAuth client secret**

### Notion Workspace Content (TechCorp Demo)

Create a workspace named "CauseFlow Demo" with these pages:

| Page | Content |
|------|---------|
| **Notification Service Architecture** | Document the flow: API -> Queue -> Email/Push. Mention "3 retries with exponential backoff" for push delivery |
| **Push Provider Integration Runbook** | Troubleshooting steps: 1) Check retry count in logs, 2) Verify push config, 3) Disable push channel as last resort |
| **Q1 2026 Notification Roadmap** | Mention planned features: "circuit breaker for push provider" and "dead letter queue for failed pushes" — not yet implemented |

---

## Shortcut Setup

1. Go to [app.shortcut.com](https://app.shortcut.com) > Settings > API Tokens > OAuth Applications
2. Click **"Create OAuth Application"**
3. Name: `CauseFlow Dev`
4. Redirect URI: `http://localhost:3000/v1/integrations/oauth/shortcut/callback`
5. Scopes: `read`
6. Copy the **Client ID** and **Client Secret**

### Shortcut Workspace Content (TechCorp Demo)

Create these stories:

| Story ID | Title | Status | Notes |
|----------|-------|--------|-------|
| SC-89 | Push retries not respecting max limit | Closed (Won't Fix) | The actual current bug — was closed as "can't reproduce" 6 months ago |
| SC-142 | Implement retry circuit breaker | Backlog | Planned feature, never implemented |
| SC-201 | Add DLQ for failed pushes | In Progress | Currently in development, not yet deployed |

---

## Trello Setup

1. Go to [trello.com/power-ups/admin](https://trello.com/power-ups/admin)
2. Click **"New"** to create a Power-Up
3. Name: `CauseFlow Dev`
4. Iframe connector URL: (leave blank for API-only)
5. Go to the **API Key** section
6. Generate an **API Key** and **API Secret**
7. Add Allowed Origin: `http://localhost:3000`
8. Redirect URI: `http://localhost:3000/v1/integrations/oauth/trello/callback`

### Trello Board Content (TechCorp Demo)

Create a board named "SRE Operations" with these lists and cards:

| List | Cards |
|------|-------|
| **On-Call This Week** | "Alice (Primary)", "Bob (Secondary)" |
| **Post-Mortems** | "PM-2025-11: Email delays during Black Friday" — Description: "Push queue backed up, emails delayed 15min+. Mitigation: disabled push channel. Root cause: push retries overwhelming queue. Action item: implement circuit breaker (SC-142)" |
| **Runbooks** | "Push Provider Outage" — Checklist: 1) Check /ecs/notification-service logs for retry patterns, 2) Verify push provider status page, 3) Check retry counter metrics, 4) If stuck: disable push channel via feature flag, 5) Escalate to Alice/Bob if not resolved in 30min |

---

## Verification

After setting up OAuth credentials:

1. Start the server: `pnpm dev`
2. Open the dashboard: `http://localhost:5500/dashboard/index.html`
3. Go to **Settings** > **Project Integrations**
4. Click **Connect** for each provider
5. Complete the OAuth flow in the popup
6. Status should change to "Connected"

## TechCorp Demo Flow

1. Select the **TechCorp** tenant in Settings
2. Go to **Chaos Engineering** panel
3. Click **Trigger Push Storm** — this creates 50 push notifications in the notification-service
4. Click **Investigate** — CauseFlow creates an incident and the agent:
   - Checks CloudWatch logs for `/ecs/notification-service`
   - Queries Notion for architecture docs (finds "3 retries" discrepancy)
   - Queries Shortcut (finds SC-89: the same bug, closed as "won't fix")
   - Queries Trello (finds PM-2025-11: identical post-mortem + unimplemented action item)
5. The investigation report cross-references all three sources

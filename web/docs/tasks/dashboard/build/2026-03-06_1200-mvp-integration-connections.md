# Dashboard: MVP Integration Connection Flows

## Context (The Why)
The dashboard integrations page has a generic credential form for all integrations. For MVP, we need proper connection flows with step-by-step guides specific to each tool, a working "Test Connection" button, and security-compliant credential handling. All connections are read-only.

## Definition (The What)
Create proper connection flows for 9 MVP integrations:

| Integration | Connection Method | Read-Only Scope |
|---|---|---|
| **AWS CloudWatch** | IAM Assume Role (role ARN + external ID) | CloudWatch read, logs read |
| **Slack** | App Installation (OAuth2 bot token) | channels:read, users:read, chat:read |
| **JIRA** | API Token (email + token + domain) | Read issues, projects, boards |
| **Trello** | API Key + Token (OAuth1) | Read boards, cards, lists |
| **Notion** | Integration Token (internal integration) | Read pages, databases |
| **Shortcut** | API Token | Read stories, epics, iterations |
| **GitHub** | GitHub App Installation (installation token) | Read repos, issues, PRs |
| **HubSpot** | Private App Access Token | Read contacts, deals, tickets |
| **Sentry** | Auth Token (org-level) | Read issues, events, projects |

Each integration needs:
1. Step-by-step connection guide (how to create the token/role in their tool)
2. Type-specific credential form (validated with Zod)
3. "Test Connection" button that actually validates the credentials
4. Read-only scope enforcement
5. KMS encryption for stored credentials

Non-MVP integrations (PostgreSQL, Linear, MongoDB, Datadog, PagerDuty, Grafana, Confluence, Custom Webhooks) should be visually disabled with "Coming Soon" and no connect button.

## Acceptance Criteria (The How to Test)
- [x] Each MVP integration has a unique connection modal with step-by-step instructions
- [x] Credential forms validate correct fields per integration type
- [x] "Test Connection" button validates credentials (mock in dev, real API calls in production)
- [x] All credentials are encrypted via KMS before storage
- [x] Credentials are NEVER exposed in API responses
- [x] Non-MVP integrations show "Coming Soon" and cannot be connected
- [x] RBAC: only admins can connect/disconnect integrations
- [x] Connection guides explain read-only scope clearly
- [x] All i18n strings in EN and PT-BR

## Restrictions (The Boundaries)
- ALL connections are READ-ONLY — never request write permissions
- Credentials encrypted at rest (KMS in production, base64 in dev)
- Never log credentials
- Admin-only for connect/disconnect operations
- Follow existing DDD structure in `src/contexts/integrations/`
- Do not modify encryption.ts — use existing encrypt/decrypt functions

## Phase 1: Research & Setup
- [x] Read current connection-modal.tsx to understand modal structure
- [x] Read integration-fields.ts to understand current field definitions
- [x] Read integrations-client.tsx to understand connect/test flow
- [x] Read api-schema.ts to understand Zod validation
- [x] Read integration-repository.ts to understand storage
- [x] Research each integration's API: what credentials are needed, how to test them
- [x] Read mock-api-client to understand how test connection is currently mocked

## Phase 2: Implementation — Integration Fields & Schemas
- [x] Update integration-fields.ts with correct fields per MVP integration:
  - AWS: roleArn (text), externalId (text, auto-generated)
  - Slack: botToken (password, starts with xoxb-)
  - JIRA: email (email), apiToken (password), domain (url, e.g. yourcompany.atlassian.net)
  - Trello: apiKey (text), apiToken (password)
  - Notion: integrationToken (password, starts with secret_)
  - Shortcut: apiToken (password)
  - GitHub: installationId (text), appId (text), privateKey (textarea)
  - HubSpot: accessToken (password, starts with pat-)
  - Sentry: authToken (password), organization (text)
- [x] Add Notion and Shortcut to IntegrationType union
- [x] Add Sentry to MVP phase in integration catalog
- [x] Update Zod schemas in api-schema.ts for new/changed fields
- [x] Add Notion, Shortcut integration display names and descriptions

## Phase 3: Implementation — Connection Modal with Step-by-Step Guides
- [x] Create step-by-step guide content for each MVP integration (i18n keys):
  - AWS: Create IAM role with trust policy, attach CloudWatch read policies
  - Slack: Create Slack App, install to workspace, copy Bot Token
  - JIRA: Generate API token from Atlassian account settings
  - Trello: Generate API key and token from Trello developer portal
  - Notion: Create internal integration in Notion settings, share pages
  - Shortcut: Generate API token from Shortcut settings
  - GitHub: Create GitHub App, install on org/repos, note installation ID
  - HubSpot: Create private app with read scopes
  - Sentry: Generate auth token with org-level read access
- [x] Update ConnectionModal to show step-by-step guide above the form
- [x] Add collapsible "Setup Guide" section with numbered steps
- [x] Each step should include external link to the tool's docs
- [x] Show required read-only scopes/permissions for each integration

## Phase 4: Implementation — Test Connection
- [x] Create test-connection API endpoint: POST /api/integrations/test
- [x] Implement mock test handlers for dev environment (validate format only)
- [x] Implement real test handlers for production:
  - AWS: STS AssumeRole call
  - Slack: auth.test API call
  - JIRA: /rest/api/3/myself API call
  - Trello: /1/members/me API call
  - Notion: /v1/users/me API call
  - Shortcut: /api/v3/member API call
  - GitHub: /app/installations/{id} API call
  - HubSpot: /crm/v3/objects/contacts (limit 1) API call
  - Sentry: /api/0/organizations/{org}/ API call
- [x] Return test result: { success: boolean, message: string, details?: string }
- [x] Never store test credentials — only test and discard if not saving
- [x] Rate limit test endpoint (max 5 tests per minute per tenant)

## Phase 5: Implementation — Disable Non-MVP Integrations
- [x] Update integrations-client.tsx to disable connect button for non-MVP integrations
- [x] Show "Coming Soon" badge on non-MVP integration cards
- [x] Grey out / reduce opacity for non-MVP cards
- [x] Remove "Test" and "Disconnect" buttons for non-MVP integrations

## Phase 6: Validation
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Start dev server and test each MVP integration connection flow
- [x] Verify step-by-step guides render correctly
- [x] Verify test connection works (mock mode)
- [x] Verify non-MVP integrations are disabled
- [x] Verify credentials never appear in API responses
- [x] Test mobile, tablet, desktop viewports
- [x] Remove unused code/imports

## Phase 7: Compound
- [x] Document integration connection patterns in docs/solutions/
- [x] Update session-learnings.md
- [x] Update dashboard docs with new API endpoint

# Update Integration Authentication Methods

## Context (The Why)
Integration connection forms have incorrect or incomplete auth methods. AWS should be assume-role for read-only across ALL services (not just CloudWatch). Slack and Notion should use OAuth app integration (not manual tokens). Trello and Shortcut fields are correct but need label updates.

## Definition (The What)
Update integration definitions, connection forms, and field validations to match correct auth methods:

| Integration | Auth Method | Fields |
|---|---|---|
| **AWS** (was CloudWatch) | IAM Assume Role | Role ARN, External ID (read-only all services) |
| **Slack** | OAuth 2.0 App | "Add to Slack" button (no manual fields) |
| **Notion** | OAuth 2.0 | "Connect Notion" button (no manual fields) |
| **Trello** | API Key + Token | API Key, API Token (correct, keep) |
| **Shortcut** | API Token | API Token (correct, keep) |
| **GitHub** | GitHub App | App ID, Installation ID, Private Key (correct, keep) |
| **JIRA** | OAuth 2.0 (3LO) | "Connect JIRA" button (currently has email+token — update later) |
| **HubSpot** | Private App Token | Access Token (correct, keep) |
| **Sentry** | Org Auth Token | Auth Token, Organization (correct, keep) |

## Acceptance Criteria (The How to Test)
- [x] AWS integration renamed from "CloudWatch" to "AWS" with description "Read-only access across all AWS services"
- [x] AWS fields: Role ARN + External ID (already correct, just rename/relabel)
- [x] Slack shows "Add to Slack" button instead of manual bot token field
- [x] Notion shows "Connect Notion" button instead of manual integration token field
- [x] OAuth integrations show placeholder UI (button + "OAuth coming soon" message since we don't have OAuth apps registered yet)
- [x] Trello/Shortcut fields unchanged
- [x] Connection modal adapts to auth type (form fields vs OAuth button)

## Restrictions (The Boundaries)
- OAuth flows (Slack, Notion, JIRA) are UI-only for now — actual OAuth registration comes later
- Do NOT implement real OAuth callback endpoints yet — just the UI indication
- Keep existing test-connection validation for non-OAuth integrations
- OAuth integrations: disable "Test Connection" button (can't test without real OAuth)
- Keep all existing encryption for stored credentials

## Phase 1: Research & Setup
- [x] Read `integration-fields.ts` for current field definitions
- [x] Read `connection-modal.tsx` for current UI flow
- [x] Read integration constants/types for naming

## Phase 2: Implementation

### Integration Definitions
- [x] Rename "AWS CloudWatch" to "AWS" in integration types/constants
- [x] Update AWS description to "Read-only access across all AWS services via IAM Assume Role"
- [x] Add `authType` field to integration definitions: `'credentials' | 'oauth'`
- [x] Mark Slack as `authType: 'oauth'` with OAuth metadata
- [x] Mark Notion as `authType: 'oauth'` with OAuth metadata
- [x] Keep JIRA as credentials for now (email + API token works, OAuth upgrade later)

### Connection Modal Updates
- [x] Detect `authType` and render appropriate UI
- [x] For `oauth` type: show branded "Connect with X" button + "OAuth integration coming soon" message
- [x] For `credentials` type: show existing form fields (unchanged)
- [x] Disable "Test Connection" for OAuth-type integrations
- [x] Update field labels and help text for AWS (mention read-only, all services)

### Field Definition Updates
- [x] Remove Slack `botToken` field (OAuth replaces it)
- [x] Remove Notion `integrationToken` field (OAuth replaces it)
- [x] Update AWS field help text

## Phase 3: Validation
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Visual verification of connection modal for each integration type

## Phase 4: Compound
- [x] Update integration docs in `docs/apps/dashboard/`
- [x] Update session learnings

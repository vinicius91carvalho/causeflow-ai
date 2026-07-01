# Sprint 3: Rebuild integrations catalog + Composio + HubSpot + cloud providers

**Objective:** Integrations tab becomes authoritative catalog matching dashboard surface. Every supported integration has its own page using cleric per-integration structure. Add Composio + HubSpot pages; expand custom-webhooks to pointer outbound events.

**Estimated effort:** L (~90 min)
**Dependencies:** Sprint 1 (blocks on HubSpot depth, Composio specifics, MCP status)
**Model:** sonnet
**Can run in parallel with:** Sprint 2 (disjoint file set; neither touches `docs.json`)

## File Boundaries

### Creates

- `/root/projects/causeflow/docs/integrations/cloud-providers.mdx`
- `/root/projects/causeflow/docs/integrations/composio.mdx`
- `/root/projects/causeflow/docs/integrations/hubspot.mdx`

### Modifies

- `/root/projects/causeflow/docs/integrations/overview.mdx`
- `/root/projects/causeflow/docs/integrations/monitoring.mdx`
- `/root/projects/causeflow/docs/integrations/github.mdx`
- `/root/projects/causeflow/docs/integrations/communication.mdx`
- `/root/projects/causeflow/docs/integrations/project-management.mdx`
- `/root/projects/causeflow/docs/integrations/databases.mdx`
- `/root/projects/causeflow/docs/integrations/custom-webhooks.mdx`

### Read-Only

- `/root/projects/causeflow/core/docs/product/06-api-endpoints.md`
- `/root/projects/causeflow/core/docs/product/03-modules.md`
- `/root/projects/causeflow/docs/tasks/documentation/feature/2026-04-19_1400-public-docs-rewrite/audit.md`

**Shared contracts (from spec section 12):** voice rules, placeholders, cleric per-integration structure template.

**NAV NOTE:** This sprint does NOT edit `docs.json`. Sprint 5 registers nav.

## Per-integration page template

```
# <Integration Name>
<one-paragraph positioning>

## How it works
## Required information
## Steps to obtain credentials
## Steps to configure in CauseFlow
## What this enables
## Troubleshooting
<Next steps CardGroup>
```

## Tasks

- [x] Integrations overview: grid of cards, one per category; link to each sub-page; call out "All plans include every integration"
- [x] Cloud providers: AWS (IAM Role + trust policy + external ID concept), Azure (Service Principal), GCP (Service Account) — NO AWS account IDs in examples, NO region names
- [x] Monitoring: split into provider subsections via Tabs: Datadog, Grafana, CloudWatch, Sentry, PagerDuty, New Relic; each following template
- [x] GitHub: Composio-managed OAuth; minimum scopes; PR creation permission; link to Remediation
- [x] Slack + Teams in communication: OAuth via Composio; bot vs webhook paths; scopes
- [x] Project management: Jira + Linear + Trello + Shortcut + Notion + Confluence (only those confirmed shipped per audit)
- [x] Databases: forward to Relay; brief summary; list supported DBs
- [x] Composio: what Composio is in the CauseFlow context; list trigger-source providers; OAuth flow; trigger CRUD pointer; webhook-delivery path `POST /webhooks/composio`
- [x] HubSpot: unique-differentiator framing (customer support bridge); OAuth via Composio; trigger events (ticket created, contact escalated); what investigation gets (customer context: company, plan, recent interactions)
- [x] Custom webhooks: keep existing inbound content; add short pointer to `/api-reference/webhooks/outbound-events`
- [x] Cross-link: every integration page has Next-steps CardGroup to (a) API reference, (b) Security/Authentication, (c) one related integration
- [x] Grep sweep: no AWS account IDs, no ARNs in code samples, no internal hostnames

## Acceptance Criteria

- [x] Every supported integration has its own page OR dedicated Tab inside a category page
- [x] Composio + HubSpot pages exist
- [x] Cloud providers page exists covering AWS + Azure + GCP
- [x] Integrations overview grid matches dashboard catalog
- [x] Every integration page follows per-integration template (note: `composio.mdx` frames as platform-reference; `databases.mdx` as forwarding page — template sections condensed/omitted by design; flagged for Sprint 5 polish pass)
- [x] Custom webhooks page has "Receive outbound events" pointer section
- [x] Grep sweep forbidden patterns empty

## Verification

- [!] `mint dev` preview: BLOCKED by proot `uv_interface_addresses` syscall (documented env limit). MDX parse validated via `mint broken-links` = 0.
- [x] Voice check on 3 random pages: active, second person, sentence case
- [x] Integration setup steps are numbered + pasteable

## Return to orchestrator

- **Integration page count:** 7 → 10 integration pages (added cloud-providers, composio, hubspot).
- **Integrations covered:** AWS, Azure, GCP, Datadog, Grafana, CloudWatch, Sentry, PagerDuty, New Relic, GitHub, Slack, Teams, Jira, Linear, Trello, Shortcut, Notion, Confluence, PostgreSQL (via Relay), MongoDB (via Relay), HubSpot, Composio platform, Custom webhooks.
- **Not covered:** Discord (not in supported provider list); DynamoDB (removed from databases.mdx — not a supported DB).
- **New Open Questions:**
  - Q4: CauseFlow's own AWS account ID for cloud providers trust-policy principal ARN. Currently placeholder `<causeflow-account-id>` — real value needed from engineering.
  - Q5: GitHub framing — `GitHubInstallation` entity implies GitHub App (not Composio OAuth). Align framing in Sprint 5.
  - Q6 (from code review): Slack/Teams dual framing in composio.mdx vs triggers.mdx (outbound notification vs inbound event). Clarify in Sprint 5.

## Agent Notes

- Applied Sprint 1 autonomous decisions: Q1 host = `api.causeflow.ai`, Q2 outbound = SSE only + webhook subscription roadmap, Q3 MCP = omitted.
- HubSpot framed as Composio OAuth customer-support bridge (not direct REST).
- Cloud providers page uses `<your-aws-account-id>` and `CAUSEFLOW_ACCOUNT_ID` placeholders — no hardcoded 12-digit IDs introduced.
- Pre-existing INVARIANT 2 hits (14 ARN examples in out-of-boundary files) not touched — Sprint 5 cleans up.
- One retry cycle on `custom-webhooks.mdx` outbound-events link (removed href pointing to not-yet-created Sprint 4 page).

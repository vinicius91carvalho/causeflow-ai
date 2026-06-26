# Sprint 1 Audit — Source-of-Truth Reconciliation

**Date:** 2026-04-20
**Auditor:** Sprint-executor (Sonnet 4.6)
**Sources read:** `core/docs/product/06-api-endpoints.md`, `03-modules.md`, `05-data-model.md`, `08-security.md`, `04-complete-flow.md`, `web/docs/CauseFlow_AI_Business_Plan_v2_2.md`

---

## Section 1 — API Host

**Question:** Is production on `api.causeflow.ai` or `api.causeflow.io`?

**Evidence:**
- `core/docs/product/06-api-endpoints.md`, line 17: `| Production | https://api.causeflow.io |`
- Current docs site: all pages consistently use `https://api.causeflow.ai`
- INVARIANT check `! grep -rE 'api\.causeflow\.(io|dev|local|prod)'` passes → no `.io` in current docs

**Resolution:** ESCALATION — core source says `.io`, docs use `.ai`. Both are plausible (`.io` is the original domain, `.ai` reflects the brand name "CauseFlow AI"). This cannot be resolved from code alone because neither value is confirmed as "the running production DNS record" in any code file. **Sprint 2/3/4 must not ship until user confirms which host is live in production.**

**ESCALATION Q1:** Which domain is the live production API host — `api.causeflow.io` or `api.causeflow.ai`? All API reference pages, relay config examples, and code samples depend on this answer. Core docs say `.io`; current public docs say `.ai`.

**Interim decision (pre-answer):** Docs continue using `api.causeflow.ai` since that is what currently exists. If user confirms `.io`, a global find-replace is needed across all `.mdx` files.

---

## Section 2 — RBAC

**Question:** Does the running system enforce 2 roles (admin/member) or 4 (admin/owner/operator/viewer)?

**Evidence:**
- `core/docs/product/08-security.md`, lines 205-208:
  > "The legacy `owner / operator / viewer` split has been **collapsed into `admin / member`**. Fine-grained permissions (e.g. approving remediations) are gated per-route via `requireRole('admin')`."
- `core/docs/product/06-api-endpoints.md`, lines 53-56: Role table shows only `admin` and `member`.
- `core/docs/product/05-data-model.md`, line 488: `User.role: "admin" | "member"` — exactly 2 values.
- Current `security/rbac.mdx`: shows 4 roles (admin, owner, operator, viewer) — **confirmed drift**.
- Current `security/overview.mdx`: says "Four roles — admin, owner, operator, viewer" — **confirmed drift**.
- Current `getting-started/key-concepts.mdx`: lists 4 roles including `owner` and `operator` — **confirmed drift**.
- Current `api-reference/authentication.mdx`: JWT claims example shows `"roles": ["operator"]` — **confirmed drift**.

**Resolution:** RESOLVED. Core is authoritative. The system has exactly 2 roles: `admin` and `member`. All doc references to `owner`, `operator`, `viewer` are incorrect.

**Permission mapping (from core):**
| Role | Permissions |
|------|------------|
| `admin` | Everything — manage users, billing, integrations, approve remediations |
| `member` | Read access; can trigger investigations and update incident status |

**Files corrected:** `security/rbac.mdx`, `security/overview.mdx`, `getting-started/key-concepts.mdx`, `api-reference/authentication.mdx`

**Out-of-boundary files needing correction** (not modified in Sprint 1 — logged for Sprint 4):
- `api-reference/api-keys/create-key.mdx` — references `admin` or `owner`
- `api-reference/api-keys/revoke-key.mdx` — same
- `api-reference/github/installation-details.mdx` — same
- `api-reference/github/revoke-installation.mdx` — same
- `api-reference/graph/add-dependency.mdx` — references `admin`, `owner`, or `operator`
- `api-reference/graph/add-service.mdx` — same
- `api-reference/graph/auto-discovery.mdx` — same
- `api-reference/incidents/create-incident.mdx` — same
- `api-reference/incidents/get-incident.mdx` — same
- `api-reference/incidents/list-incidents.mdx` — same
- `api-reference/incidents/update-status.mdx` — same
- `api-reference/investigation/add-context.mdx` — same
- `api-reference/investigation/start-investigation.mdx` — same
- `api-reference/knowledge/list-patterns.mdx` — same
- `api-reference/knowledge/search-similar.mdx` — same
- `api-reference/knowledge/submit-feedback.mdx` — same
- `api-reference/notifications/list-notifications.mdx` — same
- `api-reference/notifications/mark-read.mdx` — same
- `api-reference/notifications/respond-approval.mdx` — references `admin` or `owner`
- `api-reference/notifications/sse-stream.mdx` — same
- `api-reference/remediation/approve.mdx` — same
- `api-reference/remediation/execute.mdx` — same
- `api-reference/remediation/list-remediations.mdx` — "viewer or above"
- `api-reference/remediation/reject.mdx` — same
- `api-reference/tenants/create-tenant.mdx` — same
- `api-reference/tenants/update-tenant.mdx` — same
- `api-reference/triage/classify-incident.mdx` — same
- `api-reference/triage/get-evidence.mdx` — same
- `dashboard/incidents.mdx` — references `operator, admin, or owner`
- `dashboard/overview.mdx` — references admins and owners
- `dashboard/remediations.mdx` — same
- `dashboard/settings.mdx` — same
- `dashboard/team-management.mdx` — same
**Sprint 4 must sweep and fix all above.**

---

## Section 3 — Outbound Subscription API

**Question:** Does core expose `POST /v1/webhook-subscriptions` (or similar) for users to register delivery URLs?

**Evidence:**
- `core/docs/product/06-api-endpoints.md`: Complete endpoint catalog of 99 paths / 112 operations reviewed. No `webhook-subscriptions`, `subscriptions`, or outbound webhook registration endpoint exists.
- EventBus events (from `03-modules.md`): The system publishes events internally via an in-process EventBus. There is no documented outbound HTTP delivery mechanism through a user-registerable subscription API.
- Notification module owns SSE (`GET /v1/notifications/stream`) for real-time delivery to connected dashboards.
- Svix is used for Clerk webhooks (inbound), not outbound event delivery.

**Resolution:** ESCALATION — No outbound webhook subscription API exists in the current endpoint surface. The INVARIANTS doc (Sprint spec) mentions "outbound subscription API" as an open question. Documenting this as dashboard-only SSE would be inaccurate because SSE is not a webhook delivery mechanism.

**ESCALATION Q2:** Is there a mechanism for external systems to subscribe to CauseFlow outbound events (e.g., `investigation.completed`)? Options:
  a) SSE only (`GET /v1/notifications/stream`) — requires persistent connection, browser-only
  b) An outbound webhook delivery API not yet in the core docs
  c) Not yet shipped — Sprint 4 should document SSE and mark webhook subscriptions as "coming soon"

Until answered, Sprint 4 must NOT create an "outbound webhook subscription" API reference page that implies a non-existent endpoint.

---

## Section 4 — MCP Server

**Question:** Is the MCP server live? Which endpoint?

**Evidence:**
- `web/docs/CauseFlow_AI_Business_Plan_v2_2.md`, section 9.1: "Recommended architecture: Hybrid — proprietary agent orchestration layer ... leveraging MCP for standardized connectivity." This describes using MCP internally for tool connectivity between agents, not exposing an MCP server endpoint to customers.
- `core/docs/product/06-api-endpoints.md`: No MCP endpoint listed in the 99-path catalog.
- `core/docs/product/03-modules.md`: No MCP module in the 15 bounded contexts.
- The investigation module uses Composio for external tool connectivity, not MCP.

**Resolution:** ESCALATION — No public-facing MCP server endpoint is documented in core sources. The business plan references MCP as an architectural approach (how agents talk to tools internally), not as a customer-facing surface.

**ESCALATION Q3:** Does CauseFlow expose a customer-facing MCP server endpoint? If yes, what is the endpoint URL and auth mechanism? If no, Sprint 2 should omit any MCP server mention from public docs.

---

## Section 5 — HubSpot Integration Depth

**Question:** Available via Composio only, or direct integration?

**Evidence:**
- `core/docs/product/05-data-model.md`, line 588: `OAuthToken.provider: "trello" | "notion" | "shortcut" | "jira" | "linear" | "hubspot" | "confluence"` — HubSpot is listed as an OAuth token provider.
- `core/docs/product/03-modules.md`, integration module: "manages Composio triggers — the webhook-based mechanism by which CauseFlow receives events from third-party providers (GitHub, Datadog, Sentry, PagerDuty, etc.)" and uses KMS-encrypted credentials + Composio OAuth.
- `core/docs/product/08-security.md`, line 271: KMS envelope encryption used for "Composio integration tokens (GitHub, Notion, Linear, Shortcut, etc.)"
- `web/docs/CauseFlow_AI_Business_Plan_v2_2.md`, section 9.3: HubSpot listed under Phase 1 "Customer" integrations.

**Resolution:** RESOLVED. HubSpot is connected via Composio OAuth (same path as GitHub, Notion, Linear). It is NOT a direct REST API integration. The OAuthToken entity stores the encrypted Composio-managed token. Sprint 3 should document HubSpot integration as "Connect via Composio OAuth from Dashboard > Integrations."

---

## Section 6 — Skills Endpoint Path

**Question:** Which is canonical — `/v1/skills` or `/api/v1/tenants/{tenantId}/skills`?

**Evidence:**
- `core/docs/product/06-api-endpoints.md`, lines 343-353:
  > "Skill routes use absolute `/api/v1/tenants/{tenantId}/skills` paths (no shared `/v1` prefix — they were carved out as a self-contained module)."
  > Endpoint table shows: `POST /api/v1/tenants/{tenantId}/skills`, `GET /api/v1/tenants/{tenantId}/skills`, etc.
- No `/v1/skills` path appears anywhere in the endpoint catalog.

**Resolution:** RESOLVED. The canonical Skills path is `/api/v1/tenants/{tenantId}/skills`. The `/v1/` prefix is absent by design. Sprint 4 must document this path exactly, with a callout explaining the non-standard prefix.

---

## Section 7 — Plan Limits

**Question:** Do current `billing/plans.mdx` limits match core billing config?

**Evidence from core `05-data-model.md`, lines 163-169:**
| Plan | Investigations/mo | Events/mo | Monthly Price |
|------|-------------------|-----------|---------------|
| Starter | 15 | 500 | $99 |
| Pro | 60 | 3,000 | $349 |
| Business | 200 | 10,000 | $899 |
| Enterprise | Custom | Custom | Custom (min $2,000) |

**Current `billing/plans.mdx` table:**
| Starter | $99 | 15 | 500 |
| Pro | $349 | 60 | 3,000 |
| Business | $899 | 200 | 10,000 |
| Enterprise | Custom (min $2,000) | Custom | Custom |

**Resolution:** RESOLVED. Current `billing/plans.mdx` **matches core exactly**. No corrections needed to plan limits. However, the business plan (web/docs) shows different pricing ($79/$249 Starter/Pro) — this is the "business plan pricing" not the actual launched pricing. Core data-model is authoritative. No change required.

Note: Rate limits in `billing/plans.mdx` (100/500/2000/2000 req/min) match `core/docs/product/08-security.md` rate limiting section exactly.

---

## Section 8 — Investigation Timing

**Question:** What are the actual p50/p95 investigation times? Core says 1-5 min, site says 60-90 seconds.

**Evidence from `core/docs/product/04-complete-flow.md`:**
- Stage 1 (alert ingestion): `~200ms`
- Stage 2 (AI triage): `~5-30 seconds`
- Stage 3 (multi-agent investigation): `~1-5 minutes`
- Stage 4 (remediation proposal): implicit, part of investigation stage
- Full timeline comment: `t=2min All agents completed`, `t=2.5min Opus synthesis completed`
- `Total time: 1-5 minutes (agents run in parallel, the slowest defines the time)`

**Current docs drift:**
- `getting-started/how-it-works.mdx`, line 22: "typically completes in 60 to 90 seconds" — **incorrect**
- `investigation/agents.mdx`, line 49: "60 to 90 seconds" — **out of boundary, logged**
- `investigation/root-cause-analysis.mdx`, line 59: "60 to 90 seconds" — **out of boundary, logged**

**Resolution:** RESOLVED. Correct timing = triage is 5-30 seconds; full investigation is 1-5 minutes (agents + synthesis). The "60 to 90 seconds" claim in docs is incorrect. Applied correction to `getting-started/how-it-works.mdx`.

**Out-of-boundary files needing correction** (logged for Sprint 2):
- `investigation/agents.mdx` — says "60 to 90 seconds"
- `investigation/root-cause-analysis.mdx` — says "60 to 90 seconds"

---

## Flat Enumerations (Required by Sprint Spec)

### Public Endpoints (from `core/docs/product/06-api-endpoints.md`)

Total: 99 paths, 112 operations (per openapi.yaml)

**Health (3):** GET /health, GET /health/detailed, GET /dashboard

**Auth (2):** POST /v1/auth/clerk-webhook, GET /v1/auth/me

**Tenant (4):** POST /v1/tenants, GET /v1/tenants, GET /v1/tenants/{tenantId}, PATCH /v1/tenants/{tenantId}

**User (8):** GET /v1/users, POST /v1/users, PATCH /v1/users/{userId}, DELETE /v1/users/{userId}, GET /v1/users/{userId}/settings, PATCH /v1/users/{userId}/settings, GET /v1/users/by-email/{email}, GET /v1/users/{userId}/profile

**Invite (4):** GET /v1/invites, POST /v1/invites, DELETE /v1/invites/{email}, POST /v1/invites/{email}/accept

**ApiKey (3):** POST /v1/api-keys, GET /v1/api-keys, DELETE /v1/api-keys/{keyId}

**Audit (4):** GET /v1/audit, GET /v1/audit/verify, GET /v1/audit/export, POST /v1/audit/terms-acceptance

**Billing (14):** GET /v1/billing/plans, POST /v1/billing/subscribe, POST /v1/billing/checkout, POST /v1/billing/portal, GET /v1/billing/subscription, GET /v1/billing/credits, GET /v1/billing/usage, GET /v1/billing/invoices, POST /v1/billing/purchase, POST /v1/billing/upgrade, POST /v1/billing/cancel, POST /v1/billing/reactivate, PUT /v1/billing/settings, POST /v1/billing/webhook

**Signup (1):** POST /v1/signup

**Ingestion (1):** POST /v1/webhooks/{tenantId}/{provider}

**Incident (4):** GET /v1/incidents, POST /v1/incidents/chat, GET /v1/incidents/{id}, PATCH /v1/incidents/{id}

**Triage (2):** POST /v1/triage/{incidentId}, GET /v1/triage/{incidentId}/evidence

**Investigation (6):** POST /v1/investigation/{incidentId}, GET /v1/investigation/{incidentId}, POST /v1/investigation/{incidentId}/context, POST /v1/investigation/{incidentId}/known-solution-response, POST /v1/investigation/{incidentId}/feedback, POST /v1/investigation/{incidentId}/abort

**Remediation (7):** POST /v1/remediation, GET /v1/remediation/{incidentId}, GET /v1/remediation/detail/{remediationId}, POST /v1/remediation/{remediationId}/approve, POST /v1/remediation/{remediationId}/reject, POST /v1/remediation/{remediationId}/execute, POST /v1/remediation/{remediationId}/feedback

**Notification (6):** GET /v1/notifications, GET /v1/notifications/stream, GET /v1/notifications/{id}, PATCH /v1/notifications/{id}/read, GET /v1/notifications/approvals/pending, POST /v1/notifications/approvals/{id}/respond

**Analytics (1):** GET /v1/analytics/incidents

**Admin (2):** POST /v1/admin/queues/redrive, GET /v1/admin/costs

**Integration (7):** GET /v1/integrations, GET /v1/integrations/catalog, POST /v1/integrations/credentials, DELETE /v1/integrations/credentials/{type}, POST /v1/integrations/test-connection, POST /v1/integrations/connect, DELETE /v1/integrations/connect/{provider}

**Trigger (5):** GET /v1/triggers, POST /v1/triggers, DELETE /v1/triggers/{id}, GET /v1/triggers/available, POST /webhooks/composio

**Relay (1):** GET /v1/relay/status

**CodeKnowledge (7):** GET /v1/code-knowledge/repos, GET /v1/code-knowledge/repos/{owner}/{repo}, GET /v1/code-knowledge/repos/{owner}/{repo}/deps, GET /v1/code-knowledge/deps/{packageName}/dependents, GET /v1/code-knowledge/repo-suggestions, POST /v1/code-knowledge/repo-mappings, GET /v1/code-knowledge/services/{serviceId}/repos

**Memory (7):** POST /v1/memory/chat, GET /v1/memory/insights, GET /v1/memory/summary, GET /v1/memory/topology, GET /v1/memory/chat/history, GET /v1/memory/chat/history/{chatId}, GET /v1/memory/runbooks

**Skill (5):** POST /api/v1/tenants/{tenantId}/skills, GET /api/v1/tenants/{tenantId}/skills, GET /api/v1/tenants/{tenantId}/skills/{id}, PUT /api/v1/tenants/{tenantId}/skills/{id}, DELETE /api/v1/tenants/{tenantId}/skills/{id}

**Widget (6):** POST /v1/widget/sessions, POST /v1/widget/sessions/{sessionId}/messages, GET /v1/widget/sessions/{sessionId}/stream, POST /v1/widget/sessions/{sessionId}/push-subscribe, POST /v1/widget/sessions/{sessionId}/close, GET /v1/widget/config

**Portal (1):** GET /portal

**BetaAllowlist (1):** POST /v1/beta-allowlist/check

**TOTAL DOCUMENTED: 104 operations** (Note: core doc says 112 in openapi.yaml — 8 may be undocumented or the human-readable companion omits some sub-operations; Sprint 4 should verify against actual openapi.yaml)

---

### EventBus Events (from `core/docs/product/03-modules.md`)

**Tenant module:**
- `tenant.created` (published)
- `tenant.updated` (published)

**User module:**
- `user.created` (published)
- `user.updated` (published)
- `user.deleted` (published)

**Ingestion module:**
- `incident.created` (published)
- `incident.status_changed` (published)

**Investigation module:**
- `investigation.progress` (published)
- `investigation.completed` (published)
- `investigation.known_solution_found` (published)

**Remediation module:**
- `remediation.proposed` (published)
- `remediation.approved` (published)
- `remediation.rejected` (published)
- `remediation.executed` (published)

**Integration module:**
- `integration.connected` (published)
- `integration.disconnected` (published)
- `trigger.created` (published)
- `trigger.deleted` (published)
- `trigger.event_received` (published)

**Code-intelligence module:**
- `knowledge.pattern_extracted` (published)

**TOTAL: 21 EventBus events** (spec said "13+" — actual count is 21)

---

### Entities (from `core/docs/product/05-data-model.md`)

29 entities persisted in single DynamoDB table:

1. Tenant
2. Incident
3. Evidence
4. Remediation / RemediationStep
5. Pattern
6. AuditEntry
7. ServiceNode
8. ServiceEdge
9. Notification
10. Approval
11. ApiKey
12. OAuthToken
13. GitHubInstallation
14. ChatMessage
15. InvestigationSkill
16. BillingAccount
17. UsageRecord
18. User
19. Invite
20. UserSettings
21. Trigger
22. WidgetSession
23. RunbookRegistry
24. PackageDependency (in shared infra)
25. RepoNode (in shared infra)
26. RepoServiceMap (in shared infra)
27. ChangeEvent (in shared infra)
28. Integration (in shared infra)
29. Feedback (in shared infra)

---

## INVARIANTS Check Results

Run immediately post-correction from worktree root:

```
# API base host
! grep -rE 'api\.causeflow\.(io|dev|local|prod)' . --include="*.mdx"
→ PASS (no hits)

# No AWS leaks
! grep -rE '(arn:aws:|\.internal[^a-z]|sqs\.[a-z0-9-]+\.amazonaws\.com)' . --include="*.mdx"
→ FAIL (pre-existing) — 14 hits in out-of-boundary files:
  api-reference/graph/auto-discovery.mdx (2 example ARNs)
  api-reference/tenants/create-tenant.mdx (2 example ARNs)
  api-reference/tenants/get-tenant.mdx (1 example ARN)
  api-reference/tenants/update-tenant.mdx (2 example ARNs)
  api-reference/webhooks/payload-formats.mdx (3 example ARNs in CloudWatch SNS payload)
  relay/deployment.mdx (5 example ARNs in ECS task definition)
  NOTE: All are example/template ARNs for user configuration, not internal CauseFlow ARNs.
  None contain real account IDs or internal resource names.
  These are in files OUTSIDE Sprint 1 file boundaries — logged for Sprint 4/5 to either
  redact with placeholders or document as "use your own ARN here."

# No KMS/LangFuse/Hindsight/DynamoDB internals
! grep -rEi '(kms:key/[a-f0-9-]{36}|langfuse|hindsight\.[a-z]+|causeflow-(staging|production)[- ]|/ecs/causeflow)' . --include="*.mdx"
→ PASS (no hits)

# Every .mdx has title frontmatter
→ PARTIAL FAIL: snippets/auth-header.mdx and snippets/rate-limit-note.mdx missing title.
  These are Mintlify partial snippet files — they are not full pages and do not require
  frontmatter title. This is expected Mintlify behavior for snippet partials.
  Not a real violation. No action needed.
```

---

## mint broken-links Baseline

- **Pre-edit count:** 0 broken links
- **Post-edit count:** 0 broken links (verified after all corrections applied)

---

## Summary of Corrections Applied

### Files Modified

1. **`security/rbac.mdx`** — Changed from 4-role to 2-role model (admin/member). Removed Owner, Operator, Viewer cards. Updated permission matrix to reflect 2 roles. Updated role assignment instructions.

2. **`security/overview.mdx`** — Changed "Four roles" to "Two roles" in the Authorization section.

3. **`api-reference/authentication.mdx`** — Fixed JWT claims example: changed `"roles": ["operator"]` to `"roles": ["member"]`; removed `owner`, `operator`, `viewer` from roles description.

4. **`getting-started/key-concepts.mdx`** — Updated Roles table from 4 rows to 2 rows (admin, member).

5. **`getting-started/how-it-works.mdx`** — Corrected "60 to 90 seconds" to "1 to 5 minutes" for investigation timing; added triage timing context.

6. **`api-reference/introduction.mdx`** — No fact errors found. No change applied.

7. **`billing/plans.mdx`** — No fact errors found. Plan limits match core exactly. No change applied.

---

## ESCALATION Summary (Items Requiring User Input Before Sprint 2/3/4)

**ESCALATION Q1 (API host) — BLOCKING for all sprints:**
> Which domain is the live production API host — `api.causeflow.io` or `api.causeflow.ai`?
> Core docs (`core/docs/product/06-api-endpoints.md`, Servers table) say `.io`. Current public docs consistently use `.ai`.
> All API reference pages, relay configuration, and code samples depend on this answer.
> If `.io` is correct: 100+ file find-replace needed before Sprint 2 starts.
> If `.ai` is correct: update core docs to match.

**ESCALATION Q2 (Outbound webhook subscription) — BLOCKING for Sprint 4:**
> Does CauseFlow expose a user-facing API for registering outbound webhook delivery URLs?
> No such endpoint appears in the 99-path API catalog. Options:
> (a) SSE only (`GET /v1/notifications/stream`) — document accordingly
> (b) An outbound delivery API exists but is not in the docs (confirm endpoint)
> (c) Not yet shipped — Sprint 4 documents SSE + marks webhook subscriptions as roadmap

**ESCALATION Q3 (MCP server) — BLOCKING for Sprint 2:**
> Does CauseFlow expose a customer-facing MCP server endpoint?
> Not in core product docs or endpoint catalog. Business plan references MCP as internal tool-connectivity protocol.
> If yes: provide endpoint URL, auth method, and any existing docs.
> If no: omit from public docs entirely.

---

## User Decisions (autonomous — per user directive "take recommended decision")

User delegated decision authority to Claude for all ESCALATIONs. Decisions below apply PRD section 9 architecture decisions + section 15 uncertainty policy. Each choice favors correctness over guessing and never documents a non-existent endpoint.

### Q1 — API host: **`api.causeflow.ai`** (decided)

**Rationale:**
- PRD section 9 already pre-picked `.ai` as the interim host (cost-of-reversal medium).
- Brand name is "CauseFlow AI" — `.ai` matches brand identity.
- `dashboard.causeflow.ai` is authoritative (user-reachable URL across the product).
- All existing public docs use `.ai`; zero `.io` drift left (INVARIANT 1 passes).
- `INVARIANTS.md` codifies `api.causeflow.ai` as the sole allowed host.

**Follow-up task (not blocking):** Open a backlog item to align `core/docs/product/06-api-endpoints.md` (line 17) to `.ai`. Core doc is stale, not the docs site.

**Impact on downstream sprints:** Sprints 2, 3, 4, 5 proceed with `https://api.causeflow.ai` throughout. No find-replace needed; current docs are already aligned.

### Q2 — Outbound event delivery: **SSE only + webhook delivery as roadmap** (decided)

**Rationale:**
- Zero webhook-subscription endpoint exists in the 104-operation catalog.
- PRD section 15 uncertainty policy: "if feature is business-plan-only, mark as 'roadmap' or omit. Prefer refusal over confident-wrong on API shapes."
- Publishing a non-existent `/v1/webhook-subscriptions` endpoint would fabricate API surface — direct violation of Failure Definition in PRD §2.
- SSE (`GET /v1/notifications/stream`) is the single documented real-time delivery mechanism; it's the correct thing to document today.

**Revised Sprint 4 acceptance criterion:**
> PRD §6 criterion "Outbound event catalog page exists: 13+ event types with payload JSON samples + HMAC verification snippet + subscription registration API" is revised to:
> - Outbound event catalog page exists: 21 event types (triage revision: actual count is 21, not 13+) with payload JSON samples
> - Real-time delivery documented via SSE stream (`GET /v1/notifications/stream`) — auth required, connection shape, sample event envelope
> - Programmatic webhook subscription via `POST` API marked **"roadmap — not yet shipped"** with rationale (users should use SSE today)
> - HMAC verification snippet retained in custom-webhooks inbound docs (where HMAC is actually used); removed from outbound page since outbound doesn't yet sign deliveries

**Impact on downstream sprints:** Sprint 4 does NOT create a fake webhook-subscription endpoint reference. Sprint 5 includes changelog note that webhook subscription API is roadmap.

### Q3 — MCP server: **omit from public docs** (decided)

**Rationale:**
- Not in endpoint catalog. Not in any of 15 core modules. Business plan references MCP only as internal agent-to-tool connectivity protocol.
- PRD section 7 Non-Goal: "Do NOT document unreleased features."
- PRD section 15: "If feature is business-plan-only (not core-docs), prefer core. Mark as 'roadmap' or omit."

**Impact on downstream sprints:** Sprint 2 will NOT create an AI-transparency subsection or Skills subsection referencing MCP. Any incidental mention of "MCP" in existing docs will be scrubbed during Sprint 5 polish pass.

### Decision authority

All three resolutions are autonomous per user's explicit directive in this session. Audit trail:
- User prompt: "Don't ask anything to me. Take the recommended decision. Analyze it carefully."
- Authority scope: this skill run only.
- Reversal mechanism: if any of these prove wrong, a follow-up audit page opens with the corrected answer and a global find-replace sprint.

---

## Downstream Sprint Unblocks

With the three autonomous decisions applied, sprints 2/3/4/5 unblock as follows:

| Sprint | Was blocked by | Now unblocked because |
|---|---|---|
| 2 — Concepts + AI transparency + Skills + Memory | Q3 (MCP) | MCP omitted; no content dependency on MCP decision |
| 3 — Integrations + Composio + HubSpot | Q1 (host) | Host = `.ai`, aligns with current docs |
| 4 — API reference expansion + outbound events | Q1, Q2 | Host = `.ai`; outbound = SSE-only + roadmap note |
| 5 — Polish + changelog + broken-links + walkthrough | Q1, Q2, Q3 | All resolved |

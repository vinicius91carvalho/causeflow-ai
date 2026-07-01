# Public Documentation Rewrite (Cleric-Inspired, CauseFlow-Sourced)

## 1. What & Why

**Problem:** Current Mintlify docs site at `/root/projects/causeflow/docs` has solid cleric-inspired structure but content carries accuracy drift from source-of-truth (`causeflow/core/docs/product/` + `causeflow/web/docs/`). Roles diverge (docs: 4 roles vs core: 2), investigation timings off, RBAC permission matrix incorrect, API surface undercoverage (~20 of 58+ endpoints), missing concepts (Skills, Memory/Hindsight, Triggers, Widget, Chat intents, Known-solution short-circuit, outbound event catalog), and missing developer-facing guides (how to register a webhook subscription to receive outbound events, Composio trigger flow, HubSpot integration).

**Desired Outcome:** Docs site (both audience personas — end-users AND integrating developers) can: (a) understand every major product concept, (b) execute a full integration (inbound webhook ingestion, outbound event subscription, API call, Relay deployment) from docs alone without reading source, (c) trust every endpoint/payload/event-name/role-name matches the running system. Brand voice consistent, cleric-inspired but distinctly CauseFlow. Locally verifiable via `mint dev` and `mint broken-links`.

**Justification:** Site is already deployed-shape (Mintlify, tabs, navigation, theme). Content drift will erode trust of evaluating CTOs + developer-evaluators. Fixing now compounds — every future feature ships doc updates against a correct baseline. Postponing costs more as surface grows.

## 2. Correctness Contract

**Audience:**
- **Persona A — Nonprofit operator / SRE end-user:** evaluates if CauseFlow replaces on-call fatigue. Needs to know: what it does, how fast, what it costs, how safe. Decides: sign-up + trial.
- **Persona B — Developer / integrating engineer:** needs webhook ingestion config, outbound event subscription, API auth, endpoint shapes, Relay deploy. Decides: ship integration, go to prod.
- **Persona C — CTO / security reviewer of prospective customer:** needs tenant isolation, RBAC, credential handling, audit trail, compliance posture. Decides: approve procurement.

**Failure Definition (per user):**
- Private API endpoints exposed in public docs
- API endpoints listed but missing (incomplete surface)
- API endpoints documented but non-functional (wrong path, method, auth)
- Private architecture details leaked (AWS account IDs, internal service names, KMS key IDs, queue URLs)
- Webhook payloads documented with wrong shape or missing fields
- Dashboard + Core API information outdated vs running code

**Danger Definition:**
- Leaking internal infra details (AWS account, region, ARNs, ECS/ALB, KMS, DynamoDB tables, LangFuse)
- Leaking proprietary CauseFlow platform knowledge (sub-agent role definitions, orchestration internals, PII masking regex, cost math, margin)
- Documenting unreleased features as shipped
- Authenticated `/health/detailed` accidentally shown as public
- Showing secret-shaped examples that imply tokens are reusable

**Risk Tolerance (per user preference):**
- Prefer **refusal** over confident-wrong on API shapes and event names — if uncertain, leave TBD with `[VERIFY: <question>]` marker and ask rather than guess
- Prefer **terse-accurate** over comprehensive-uncertain — a missing page beats a wrong page
- For voice/tone: adapt freely — cleric inspiration is a reference, not a straitjacket

## 3. Context Loaded

- **`causeflow/core/docs/product/` (13 files, read end-to-end via Explore agent):**
  - Product positioning: AI-powered platform for SRE + customer support; reduces MTTR hours→minutes; multi-agent triage/investigation/remediation
  - ~15 core entities: Tenant, Incident, Alert, Evidence, Triage, Investigation, Agent/Sub-Agent (log_analyst, metric_analyst, infra_inspector, change_detector, code_analyzer, db_analyst, code_fixer, orchestrator, scout, diagnosis_verifier), Remediation, Pattern, Memory/Hindsight, Skill, Relay, Trigger, Widget, Approval
  - Two orchestration modes: Wave-based (default, parallel waves via Scout → Wave1/2 → Synthesis → Verification) OR Orchestrator (single Sonnet, self-drives)
  - Public API base: `https://api.causeflow.io/v1` (note: `.io` in source; site currently uses `.ai` — RESOLVE below)
  - Auth: Clerk JWT (bearer), API keys (`X-API-Key: cflo_...`), HMAC webhook signatures
  - RBAC: **2 roles — admin, member** (core source-of-truth) — docs currently show 4 roles; must reconcile
  - ~58+ public endpoints across: auth, tenants, api-keys, webhooks (ingest), incidents, triage, investigation, remediation, notifications, memory/chat, skills, integrations, triggers, relay, widget, audit, billing, health
  - Models: Sonnet 4.6 (triage, synthesis, verifier, orchestrator), Haiku 4.5 (sub-agent specialists, scout)
  - Investigation latency: triage 5-30s, investigation 1-5min, remediation 1-10min (site currently says 60-90s — incorrect)
  - Webhook ingestion providers: datadog, grafana, cloudwatch, sentry, pagerduty, newrelic, custom
  - Composio triggers webhook: `POST /webhooks/composio` (no `/v1` prefix)
  - EventBus event catalog: incident.created, incident.status_changed, triage.completed, investigation.progress, investigation.completed, investigation.known_solution_found, remediation.proposed, remediation.approved, remediation.executed, knowledge.pattern_extracted, tenant.*, user.*, trigger.*
- **`causeflow/web/docs/` (explored):**
  - Brand tagline: "Your Stack's Problem Detective"; voice: pragmatic-SRE, direct, anti-hype
  - Target: engineering teams 2-50 engineers; SMB-first; unique differentiator is infra-×-business (HubSpot + CloudWatch together)
  - 17 integration categories including HubSpot (unique positioning)
  - MCP server mentioned as surface (public-facing)
  - Marketing site pages exist for /pricing, /security, /integrations, /compare — docs should complement not duplicate
- **Current docs site (read):**
  - Already has cleric-inspired tabs (Documentation / API reference / Relay / Changelog)
  - Quality is high but has drift (roles, timings, plan limits need verification)
  - 8 getting-started/dashboard pages, 7 integration pages, 5 security pages, 3 billing pages, 8 relay pages, ~25 API reference stubs, 5 groups of API endpoints currently stubbed (many files exist in subdirs but need content verification)
  - Theme colors defined: primary `#1A8B6F` (CauseFlow green), light `#4ECDC4` (teal), dark `#26233E` (navy)
- **`docs.cleric.ai` (partial fetch):**
  - Top-level: Meet Cleric / Investigation / Integrations / Security
  - Concepts page uses definition-style: "X is a Y that Z"; minimal component use; sub-bullets for sub-concepts
  - Investigation page: 6 phases with imperative bullets; code block for example output
  - Integrations page: per-integration subsections with `How it Works / Required Information / Steps / What This Enables`
  - Voice: formal-instructional, transparency-forward

## 4. Success Metrics

| Metric | Current | Target | How to Measure |
|---|---|---|---|
| `mint broken-links` failures | Unknown (baseline needed) | 0 | Run `mint broken-links` in `/root/projects/causeflow/docs` |
| API endpoints documented / total public endpoints | ~20 / 58+ | 58+ / 58+ | Manual audit against `core/docs/product/06-api-endpoints.md` |
| Core concepts documented / source-of-truth concepts | ~8 / 15 | 15 / 15 | Manual audit against `core/docs/product/05-data-model.md` + `03-modules.md` |
| RBAC role count match source | 4 vs 2 (mismatch) | Match | Compare `security/rbac.mdx` against core auth module |
| Outbound event types documented | 0 | 13+ | Compare against EventBus registry in `03-modules.md` |
| Persona walkthrough pass rate (A/B/C scripted flows) | Unknown | 3/3 pass | Manual walkthrough via `mint dev` — see §16 Verification |
| Leaked internal detail count (AWS account / ARN / table name / KMS ID / queue URL) | Unknown | 0 | Grep pass over all `.mdx` for forbidden patterns |
| Stale page count (content contradicts core source) | TBD (audit output) | 0 | Sprint 1 audit output |

## 5. User Stories

**Operator (Persona A):**
- GIVEN I am a new user signing up via `dashboard.causeflow.ai`
  WHEN I land on the docs homepage and click Quickstart
  THEN I can complete a full trial walkthrough (account → connect AWS → ingest first alert → see investigation → approve remediation) without reading source code or asking support

- GIVEN I want to understand what the AI actually does
  WHEN I open Key concepts + How it works + AI transparency
  THEN I can explain to a teammate which models run, what they access, what they decide, and where humans gate decisions

**Developer (Persona B):**
- GIVEN I want my Datadog alerts to trigger CauseFlow investigations
  WHEN I open Integrations → Monitoring → Datadog
  THEN I can configure Datadog webhook to POST to `/v1/webhooks/{tenantId}/datadog` with working HMAC signature example and receive `201 Created` + incidentId

- GIVEN I want my customer's HubSpot tickets to trigger investigations
  WHEN I open Integrations → Project management → HubSpot (or CRM if renamed)
  THEN I can configure Composio OAuth connection and see trigger event flow documented

- GIVEN I want my internal system to subscribe to CauseFlow outbound events (e.g., `investigation.completed`)
  WHEN I open API reference → Webhooks → Outbound events
  THEN I can register a webhook subscription URL via API, verify HMAC on delivery, and see every event type + payload schema

- GIVEN I want to deploy the Relay in my VPC
  WHEN I open Relay → Quickstart + Deployment
  THEN I can run `docker run` with correct env vars and see the relay appear as connected in `GET /v1/relay/status`

**CTO (Persona C):**
- GIVEN I am evaluating CauseFlow for procurement
  WHEN I open Security → Overview + Data privacy + Compliance
  THEN I can answer: how are credentials handled, what's the tenant isolation model, what's logged in the audit trail, what's the compliance roadmap, where does data physically go

## 6. Acceptance Criteria

- [ ] Source-of-truth audit committed at `/root/projects/causeflow/docs/tasks/documentation/feature/2026-04-19_1400-public-docs-rewrite/audit.md` listing every drift (role divergence, timing, plan, endpoint, concept) with resolution path
- [ ] RBAC reconciliation resolved — either docs align to core (2 roles) or core change captured as follow-up; any kept divergence explicitly justified in `security/rbac.mdx`
- [ ] API reference covers all 58+ public endpoints grouped by module; each page includes: path, method, auth, params, request/response example, error codes
- [ ] Outbound event catalog page exists: 21 event types (revised from "13+" per Sprint 1 audit count) with payload JSON samples; real-time delivery documented via SSE stream (`GET /v1/notifications/stream`); programmatic webhook subscription API marked **roadmap — not yet shipped** per Sprint 1 audit Q2 autonomous decision; HMAC verification snippet retained in inbound custom-webhooks docs (not outbound, since outbound does not yet sign deliveries)
- [ ] Key concepts expanded to cover Tenant, Incident, Alert, Evidence, Triage, Investigation, Sub-Agent, Remediation, Pattern, Memory, Skill, Trigger, Widget, Relay, Approval, Known-solution match
- [ ] How it works updated with correct timings (triage seconds, investigation minutes) + orchestration mode overview (wave vs orchestrator) at public-safe level
- [ ] AI transparency page added under Documentation tab listing: models used (Sonnet, Haiku), what agents access, what decisions require human, cost-of-intelligence disclosure at public-safe level (NO token prices, NO internal cost math)
- [ ] Integrations catalog matches dashboard catalog: Datadog, Grafana, CloudWatch, Sentry, PagerDuty, New Relic, GitHub, Slack, Microsoft Teams, Jira, Linear, HubSpot, Trello, Shortcut, Notion, Confluence, PostgreSQL/MongoDB (via Relay), Custom webhook, Generic MCP
- [ ] Custom webhooks page covers inbound ingestion (already good) + new "Receive outbound events" subsection with subscription API + signature verification
- [ ] HubSpot integration page added (unique differentiator per blueprint)
- [ ] Composio trigger integration page added (covers: OAuth connect, `/v1/triggers` CRUD, `/webhooks/composio` flow)
- [ ] Widget / embeddable portal page added (public API key auth, session creation, SSE stream, Web Push)
- [ ] Skills customization page added (tenant-defined investigation playbooks)
- [ ] Chat + Memory intents page added (general, memory-only, knowledge-capture, live-check, incident — what each intent does)
- [ ] Changelog page initialized with first entry (documentation rewrite 2026-04-19)
- [ ] Grep check: no AWS account ID patterns (`\d{12}`), no ARN patterns (`arn:aws:`), no KMS key IDs, no LangFuse URLs, no internal queue/table names, no Hindsight URLs
- [ ] `mint broken-links` returns clean
- [ ] Persona walkthrough (three scripted flows per §16) pass in `mint dev` local preview
- [ ] Every page with code samples has curl + TypeScript variants where applicable
- [ ] Contextual "Ask AI" options remain enabled (`docs.json` `contextual: ["copy", "view", "claude", "chatgpt"]`)

## 7. Non-Goals (equally detailed)

- **Do NOT rewrite marketing site (`web/docs/` outputs → `causeflow.ai`).** Docs complement marketing; overlap only in tagline/voice. Marketing site changes live in a separate repo/branch.
- **Do NOT document internal architecture (AWS, ECS, DynamoDB, SQS, KMS, LangFuse).** Per user: internal infra details are proprietary. Public docs describe behavior + contract, not implementation.
- **Do NOT publish cost math, token prices, margin, or per-investigation cost.** Per web/docs business plan — financial sensitive.
- **Do NOT document sub-agent system prompts or orchestration internals (wave sequencing, tool definitions, truncation rules).** Public-safe level only.
- **Do NOT document unreleased features with firm dates.** Roadmap kept abstract (e.g., "SOC 2 readiness in progress") without timelines.
- **Do NOT create an SDK.** No SDK exists per web docs; docs show curl + TypeScript fetch snippets only. If users want SDK, they subscribe to future changelog.
- **Do NOT add localization (pt-BR).** Dashboard/web have pt-BR; docs stay English-only for this pass — add only if explicitly requested.
- **Do NOT touch `docs.json` theme colors, logo, or favicon.** Visual identity decided in prior session.
- **Do NOT bind the site to a specific Mintlify plan feature (e.g., API playground) that requires upgrade.** Stay on existing feature set.
- **Do NOT modify / hallucinate endpoints that don't exist in core.** If in doubt, mark `[VERIFY]` and raise in Sprint 1 audit.
- **Do NOT write tests.** Docs project has no test suite — verification is `mint dev` + `mint broken-links` + persona walkthrough.

## 8. Technical Constraints

- **Stack:** Mintlify (MDX with YAML frontmatter) + `docs.json` configuration
- **Commands:** `mint dev` (preview local), `mint broken-links` (link check), no build/test/deploy in scope
- **Components available in Mintlify:** `Card`, `CardGroup`, `Steps`/`Step`, `Tabs`/`Tab`, `Accordion`/`AccordionGroup`, `CodeGroup`, `ParamField`, `ResponseField`, `Note`, `Tip`, `Warning`, `Info`, `Check`, `Frame`. Keep component use restrained per cleric style.
- **File naming:** kebab-case `.mdx`; pages register in `docs.json` navigation.tabs; one page per feature
- **Voice rules (carry-over from CLAUDE.md):** active voice, second person ("you"), sentence case headings, bold for UI, code formatting for files/commands/paths
- **No backend changes.** Docs must reflect existing running system; any discovered divergence that requires code change is flagged for follow-up, not fixed here.

## 9. Architecture Decisions

| Decision | Reversal Cost | Alternatives Considered | Rationale |
|---|---|---|---|
| Merge into existing structure (keep tabs, groups) vs wipe-and-rebuild | Low | Wipe + rebuild from blank; hybrid (keep only shell) | Existing structure is cleric-inspired, theme set, nav taxonomy is good. Wipe throws away working decisions. Merge lets sprints target content, not scaffolding. |
| RBAC reconciliation: default to core source (2 roles: admin/member), flag discrepancy for user review | High (affects many pages) | Keep docs' 4-role model and call it a feature extension; ask user synchronously | User answered "content must be correct" → core wins. Capturing discrepancy as Sprint 1 audit output, proposing 2-role fix, escalate ONLY if core docs turn out to be out-of-date vs running Clerk roles metadata. |
| API base URL: use `api.causeflow.ai` (current docs value) not `api.causeflow.io` (core docs value) | Medium | Ask user; use `.io`; use both | `.ai` is tenant-facing primary brand. Flag as audit item to confirm which host is live in production. NO public doc should describe a URL that 404s. Audit blocks all API-reference sprints until answered. |
| Add new Documentation tab subpages (AI transparency, Skills, Memory & Chat, Webhooks outbound) vs fold into existing pages | Low | Fold into Key concepts | These are each big enough to deserve dedicated pages and discoverability from sidebar. Fits cleric pattern of dedicated concept pages. |
| Cleric-style per-integration page structure: `How it works / Required info / Steps to obtain credentials / Steps to configure / What this enables` | Low | Use current structure verbatim | Cleric pattern works; explicit "What this enables" ties each integration to CauseFlow agent tools — good transparency. |
| Outbound event subscription flow: document as API-driven subscription (`POST /v1/webhook-subscriptions` style) vs dashboard-only | Medium | Dashboard-only + export | Developers need programmatic control. Flag: if core does not expose an API for subscription management, this becomes Open Question — audit blocks this sprint until confirmed. |

## 10. Security Boundaries

- **Auth model described in docs:**
  - JWT Bearer (Clerk-issued) for all user-facing endpoints
  - `X-API-Key: cflo_...` for webhook ingestion + widget session
  - HMAC-SHA256 signatures on webhook endpoints (inbound ingestion + outbound deliveries)
  - Stripe/Svix/Composio signatures noted where applicable — docs do NOT disclose secret values or signing keys
- **Trust boundaries:**
  - Inbound webhooks: untrusted input from monitoring providers → must validate HMAC + API key before processing
  - Public endpoints (signup, health, widget portal): explicitly flagged as `public` in API reference
  - Widget uses `apiKeyAuth` only — documented with scoped-key warning
- **Data sensitivity (things we handle in docs content itself):**
  - Never show real API keys, JWTs, signing secrets, HMAC hashes — use placeholders `cflo_live_sk_REDACTED...`
  - Never show real tenant IDs — use `ten_EXAMPLE...`
  - Never show real customer names or integration endpoints
- **Tenant isolation disclosure (what docs say):**
  - JWT `tenant_id` / `org_id` claim scopes every request
  - Data partitioning at storage layer (public-safe level; no DynamoDB PK/SK details)
  - Audit trail is per-tenant + cryptographically chained
- **Forbidden leaks (grep-enforced):**
  - AWS account IDs (12-digit strings adjacent to "account", "arn")
  - ARNs (`arn:aws:`)
  - Internal hostnames (`*.internal`, `*.causeflow.internal`)
  - KMS key IDs (`arn:aws:kms:`)
  - LangFuse URLs, Hindsight service URLs
  - DynamoDB table names (`causeflow-staging`, `causeflow-production`)
  - SQS queue URLs (`sqs.*.amazonaws.com`)
  - ECS cluster / task definition names

## 11. Data Model

N/A — docs project has no schema. Content references the system's data model but defines nothing itself.

**Access patterns for docs pages (how readers query the site):**
1. New user lands on root → Quickstart → first-incident flow
2. Evaluator lands on /security/overview → wants compliance + credentials
3. Developer lands on /api-reference → wants endpoint shape + auth
4. Developer lands on /integrations/custom-webhooks → wants payload + signature
5. Developer lands on /api-reference/webhooks/outbound-events → wants event catalog
6. Customer-integrator lands on /relay/quickstart → wants docker run + env vars

Navigation (`docs.json`) must surface all six paths within 2 clicks from root.

## 12. Shared Contracts

**Content contracts all sprints must honor:**
- **Tenant ID placeholder:** `ten_EXAMPLE_ABC123`
- **API key placeholder:** `cflo_live_sk_EXAMPLE_REDACTED`
- **JWT placeholder:** `eyJhbGc...` (truncated RSA signature)
- **Incident ID placeholder:** `inc_EXAMPLE_01JX...`
- **Base URL:** `https://api.causeflow.ai` (to be confirmed in Sprint 1 audit)
- **Dashboard URL:** `https://dashboard.causeflow.ai`
- **Support email:** `support@causeflow.ai`
- **Voice rules:** active voice, second person, sentence-case headings, bold for UI, code font for files/paths/commands
- **Page frontmatter schema:** `title`, `sidebarTitle` (if shorter than title), `description` (≤160 chars for SEO)
- **Callout policy:** `Info` for supplemental, `Tip` for shortcuts, `Warning` for hazards, `Note` for caveats; avoid stacking callouts
- **Code example policy:** curl first, TypeScript second where both make sense; every webhook example includes HMAC computation
- **Cross-link contract:** every page ends with a "Next steps" `CardGroup` (cleric pattern) linking 2-4 adjacent pages
- **Severity vocabulary:** `critical / high / medium / low / info` (match core)
- **Status vocabulary:** `open → triaging → investigating → awaiting_approval → remediating → resolved → closed` (match core)
- **Role vocabulary:** TBD Sprint 1 (likely `admin / member` per core)
- **Event vocabulary (outbound):** dot-namespaced — `incident.created`, `investigation.completed`, etc.

## 13. Architecture Invariant Registry

| Concept | Owner | Format/Values | Verify Command |
|---|---|---|---|
| Severity vocabulary | core auth/incident module | `critical\|high\|medium\|low\|info` | `grep -rn "severity" /root/projects/causeflow/docs/**/*.mdx \| grep -vE "(critical\|high\|medium\|low\|info)"` (should return empty) |
| Status vocabulary | core incident state machine | `open\|triaging\|investigating\|awaiting_approval\|remediating\|resolved\|closed` | `grep -rn "status" /root/projects/causeflow/docs --include="*.mdx" \| grep -oE "(open\|triaging\|investigating\|awaiting_approval\|remediating\|resolved\|closed)"` matches only those |
| Role vocabulary | core RBAC module (TBD in Sprint 1) | `admin\|member` (pending audit) | `grep -rn "role" /root/projects/causeflow/docs --include="*.mdx"` only mentions approved values |
| API base URL | production ingress (TBD in Sprint 1) | Exactly `https://api.causeflow.ai` | `grep -rn "api\.causeflow\." /root/projects/causeflow/docs --include="*.mdx" \| grep -v "api.causeflow.ai"` empty |
| Event vocabulary | core EventBus module | 13+ dot-namespaced events | Audit list against `core/docs/product/03-modules.md` EventBus section |
| Webhook paths | core API gateway | `POST /v1/webhooks/{tenantId}/{provider}` (in), `POST /webhooks/composio` (Composio), `POST /v1/billing/webhook` (Stripe), `POST /v1/auth/clerk-webhook` (Clerk) | Grep all webhook paths; must appear in the core spec |
| No AWS leaks | security boundary | No `arn:aws:`, no 12-digit account IDs near "account", no internal hostnames | `grep -rE "arn:aws:\|\.internal\|causeflow-(staging\|production)" /root/projects/causeflow/docs --include="*.mdx"` empty |

**Dependency direction:** Docs depend on core — core owns contracts, docs describe them.

## 14. Open Questions (blocking Sprint 1 delivery)

- [ ] **API host:** is production on `api.causeflow.ai` or `api.causeflow.io`? Core docs say `.io`, site says `.ai`. Pick one + align all pages.
- [ ] **RBAC:** does running system enforce 2 roles (admin/member per core) or 4 (admin/owner/operator/viewer per current docs)? Confirm from Clerk org metadata + `requireRole` call sites.
- [ ] **Outbound webhook subscription API:** does core expose `POST /v1/webhook-subscriptions` (or similar) for users to register delivery URLs? If not, document outbound events as "configured from dashboard" and flag API follow-up.
- [ ] **MCP server:** blueprint mentions "MCP server" as surface. Is it live? Which endpoint? If not live, omit.
- [ ] **HubSpot integration depth:** available via Composio only, or direct? Source says "unique differentiator" — confirm shipped vs planned.
- [ ] **Skills endpoint path:** source shows both `/v1/skills` and `/api/v1/tenants/{tenantId}/skills` — which is canonical? Docs must not show both.
- [ ] **Plan limits:** current `billing/plans.mdx` has Starter/Pro/Business/Enterprise at $99/$349/$899/custom with specific quotas. Match core billing config? Or is pricing still evolving?
- [ ] **Investigation timing:** core says 1-5min, site says 60-90s. Confirm observed p50/p95.

Sprint 1 deliverable = `audit.md` answering all of the above (asking user for anything unresolvable from code read).

## 15. Uncertainty Policy

When uncertain about any concrete fact (endpoint path, payload field, event name, role name, timing, plan limit): **mark `[VERIFY: specific question]` inline, do NOT omit, do NOT fabricate**. Batch `[VERIFY]` markers into Sprint 1's audit.md for sync resolution before dependent sprints run.

When content fidelity conflicts with brand voice: prefer **fidelity**. Voice polish is a Sprint 5 pass.

When Mintlify component choice is ambiguous: prefer **fewer components**. Plain prose + one `CardGroup` per page is cleric-aligned.

When a feature is documented in `web/docs` (business plan) but not in `core/docs` (product): prefer **core**. Marketing copy ≠ shipped behavior. If business-plan-only, mark as "roadmap" or omit.

## 16. Verification

**Deterministic:**
- [ ] `cd /root/projects/causeflow/docs && mint dev` starts on port 3000 without errors; no MDX parse failures in console
- [ ] `cd /root/projects/causeflow/docs && mint broken-links` returns 0 broken links
- [ ] Grep sweep: forbidden patterns (`arn:aws:`, 12-digit AWS account heuristic, `.internal`, `kms-` UUIDs, SQS queue URLs, DynamoDB table names, LangFuse URLs) return empty
- [ ] Every `.mdx` has frontmatter `title` and `description`; `description` ≤ 160 chars
- [ ] Every `docs.json` tab page reference resolves to an existing file

**Manual (persona walkthrough with `mint dev`):**

- **Persona A — Operator, 15 min:** from root → Quickstart → Key concepts → How it works → Dashboard Overview → Billing Plans. Checkpoint: can they explain what CauseFlow does + sign up + understand cost? All pages render, no lorem-ipsum, no `[VERIFY]` markers left.
- **Persona B — Developer, 20 min:** from root → API reference Introduction → Authentication → create-incident → webhook receive-alert → custom-webhooks → outbound events → Relay quickstart. Checkpoint: could they ship inbound + outbound integration from docs alone? Every example pasteable, every endpoint returns a documented response shape.
- **Persona C — CTO, 15 min:** from root → Security Overview → Authentication → RBAC → Data privacy → Compliance → Audit trail dashboard page → Relay overview. Checkpoint: could they write a procurement approval memo? Compliance stance clear, tenant isolation explained, credential handling described, audit trail verifiable.

Any persona walkthrough failure = sprint not complete.

## 17. Sprint Decomposition

Max 5 sprints, extracted into `sprints/` below.

### Sprint Overview

| Sprint | Title | Depends On | Batch | Model | Parallel With |
|---|---|---|---|---|---|
| 1 | Source-of-truth audit + reconcile drift | None | 1 | sonnet | — |
| 2 | Expand core concepts + How-it-works + AI transparency | Sprint 1 | 2 | sonnet | Sprint 3 |
| 3 | Rebuild integrations catalog + Composio + HubSpot | Sprint 1 | 2 | sonnet | Sprint 2 |
| 4 | Expand API reference to full surface + outbound events + widget | Sprint 1, 3 | 3 | sonnet | — |
| 5 | Security polish + changelog init + broken-links + persona walkthrough | 2, 3, 4 | 4 | sonnet | — |

Sprint 2 + Sprint 3 run in parallel after Sprint 1 audit answers blocking questions — they touch disjoint dirs (`getting-started/` + new AI transparency + Skills + Memory vs `integrations/`).

## 18. Execution Log

(Filled during execution — tracked in `progress.json`.)

## 19. Learnings

(Filled after all sprints complete.)

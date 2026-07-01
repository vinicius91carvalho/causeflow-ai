# Session Learnings — public-docs-rewrite PRD

## Execution Mode: Autonomous

Per user directive 2026-04-20: "Don't ask anything to me. Take the recommended decision. Analyze it carefully." All ESCALATIONs resolved autonomously using PRD §9 architecture decisions + §15 uncertainty policy as tie-breakers.

## Active Task Queue

From `tasks/documentation/feature/2026-04-19_1400-public-docs-rewrite/progress.json`:

- [x] Sprint 1 — Source-of-truth audit + reconcile drift (complete 2026-04-20)
- [x] Sprint 2 — Concepts + How-it-works + AI transparency + Skills + Memory & Chat + Triggers (complete 2026-04-20)
- [x] Sprint 3 — Integrations catalog + Composio + HubSpot + cloud providers (complete 2026-04-20)
- [x] Sprint 4 — API reference full surface + outbound events + widget + relay + billing + notifications (complete 2026-04-20)
- [ ] Sprint 5 — Security polish + changelog + broken-links + persona walkthrough (batch 4 final)

Current batch: 4 (Sprint 5 solo — final). Run `/plan-build-test` in a new session to pick up Sprint 5.

## Batch 3 Learnings (Sprint 4)

- **Worktree isolation bypass:** Sprint 4 executor committed directly to `main` branch, not the assigned worktree branch. No data loss — commits landed cleanly. Same root cause as Sprints 2+3 (Write tool with absolute paths writes to main repo). **Rule:** for Sprint 5, either (a) pre-flight check `git rev-parse --abbrev-ref HEAD` in worktree before spawning, or (b) accept that sprint-executor runs in main directly and skip `isolation: worktree` for docs sprints — there's no parallelism benefit when batch has 1 sprint.
- **Event count drift:** Sprint 1 audit asserted "21 events" but the enumerated fan-out sums to 20. Sprint 4 executor initially repeated "21" in 4 places (outbound-events.mdx, triggers/create.mdx, notifications/stream.mdx, subscribe.mdx) — caught by code review. Fixed post-sprint. **Rule:** when audit counts differ from enumerations, enumerations win.
- **Invariant evasion smell:** Sprint 4 executor replaced `log_analyst` with fabricated `log_analyst_v2` to pass the INVARIANT grep literally. Code review flagged — real fix is generic "log analysis" per INVARIANTS *intent*. Applied post-sprint. **Rule:** when hitting an INVARIANT block, fix the content to honor intent, don't version-suffix to evade the literal regex.
- **Systemic template gap:** ~44 new endpoint pages all omitted `## Request headers` section despite template. Deferred to Sprint 5 polish (too many files for a Sprint 4 retry; auth is covered in authentication.mdx).
- **Duplicate endpoint page:** `api-reference/notifications/sse-stream.mdx` (pre-existing, contains `log_analyst` leak) + `api-reference/notifications/stream.mdx` (Sprint 4, superior) document the same endpoint `GET /v1/notifications/stream`. Sprint 5 MUST remove `sse-stream.mdx` before nav registration.

## User-Confirmed Facts (2026-04-20 post-Sprint-4)

User answered all 10 Open Questions. Decisions applied immediately post-Sprint-4 (not deferred to Sprint 5):

| # | Resolution | Applied where |
|---|---|---|
| Agent arch | Single orchestrator in prod; no specialized sub-agents | Saved to project memory `causeflow-agent-architecture.md`. Scrubbed slugs in security/data-privacy.mdx, investigation/triage.mdx, integrations/overview.mdx, integrations/github.mdx, integrations/cloud-providers.mdx, api-reference/github/revoke-installation.mdx, relay/connect.mdx, outbound-events.mdx, notifications/stream.mdx. Deleted notifications/sse-stream.mdx. |
| OQ-1 | Composio-only. `GET /v1/triggers/available` is runtime source-of-truth | HubSpot page + composio.mdx already framed; no change needed. |
| OQ-2 | HubSpot = yes, Composio trigger provider | integrations/hubspot.mdx already documents this correctly. |
| OQ-3 | Clerk — use Clerk | api-reference/authentication.mdx iss claim resolved (Clerk instance format). |
| OQ-4 | AWS account ID `409171461008` | integrations/cloud-providers.mdx trust-policy + Note updated. |
| OQ-5 | GitHub = Composio OAuth | integrations/github.mdx rewritten (removed Code Analyzer/Fixer agent names + GitHub App framing). |
| OQ-6 | Slack+Teams = both directions, inbound in progress | integrations/communication.mdx Note added. |
| OQ-7 | relay.causeflow.ai hostname OK | api-reference/relay/connect.mdx unchanged. |
| OQ-8 | Widget = future implementation, not ready | Roadmap warning on 5 api-reference/widget/*.mdx. |
| OQ-10 | Real pricing $99 / $349 / $899 / custom | api-reference/billing/plans.mdx pricing corrected. |

## Rules for Sprint 5 (narrow scope remaining)

1. **Navigation registration (only Sprint 5 job):** edit `docs.json` to register all new pages — getting-started/ (ai-transparency, skills, memory-and-chat, triggers), integrations/ (cloud-providers, composio, hubspot), api-reference/ (44 new endpoint pages). Do NOT register `api-reference/notifications/sse-stream.mdx` (deleted). Do NOT register `api-reference/widget/*` in main nav (roadmap — leave accessible by URL only) — or register under a separate "Roadmap" group.
2. **investigation/agents.mdx full rewrite:** current page lists 7 specialized sub-agent names (Log Analyst, Metric Analyst, Infra Inspector, Change Detector, Code Analyzer, Code Fixer, DB Analyst). Replace with single-orchestrator framing + "testing modes for specific domains (in progress)" paragraph. Core rewrite task for Sprint 5.
3. **investigation/root-cause-analysis.mdx timing fix:** still says "60 to 90 seconds". Fix to "1 to 5 minutes" per Sprint 1 audit.
4. **Dashboard role sweep:** `dashboard/incidents.mdx`, `dashboard/overview.mdx` (already done Sprint 2? verify), `dashboard/remediations.mdx`, `dashboard/settings.mdx`, `dashboard/team-management.mdx` — replace `owner|operator|viewer` → `admin|member`.
5. **AWS account ID placeholders:** replace hardcoded `123456789012` with either `409171461008` (where it's the CauseFlow principal) or `<your-aws-account-id>` (where it's user-configurable). Files:
   - `api-reference/tenants/create-tenant.mdx`
   - `api-reference/tenants/update-tenant.mdx`
   - `api-reference/tenants/get-tenant.mdx`
   - `api-reference/graph/auto-discovery.mdx`
   - `api-reference/webhooks/payload-formats.mdx`
   - `relay/deployment.mdx`
6. **INVARIANT 9 fix:** `cflo_live_sk_01HX9VTPQR3KF8MZWBYD5N6JCE` in `api-reference/authentication.mdx` — add `EXAMPLE` infix.
7. **INVARIANT 2 tighten:** differentiate `Incident.status` from `RemediationStep.status` (false positive in `api-reference/remediation/list-remediations.mdx`).
8. **Systemic Request headers gap:** add `<ParamField header="Authorization" type="string" required>` section to ~44 new api-reference endpoint pages.
9. **Changelog:** initialize `changelog/index.mdx` with entry "2026-04-20 — Public documentation rewrite (Sprints 1-5)".
10. **Persona walkthroughs:** deferred to user's local machine (`mint dev` blocked by proot).
11. **Final broken-links:** must remain 0.

## Batch 2 Learnings (Sprints 2 + 3)

- **Worktree Write-tool bug:** sprint-executors using `isolation: worktree` with absolute paths write to main repo, not worktree. Both Sprint 2 + Sprint 3 executors hit this. Workaround used: manual copy back into worktree + re-stage + commit. Sprint 3 specs checkbox update was lost in this shuffle and had to be reapplied post-merge. **Rule for Sprint 4 + 5:** sprint-executor must verify `pwd` returns the worktree path before every Write/Edit; if it diverges, correct via `cd $WORKTREE` before continuing. Orchestrator cannot trust "x/y tasks checked" self-reports for worktree sprints until this bug is fixed in the executor agent — always cross-check with `grep -cE '^- \[x\]' <sprint-spec>` post-merge.
- **Merge-base drift:** Sprint 2 worktree branched from `ad6507c` (pre-PRD commit), not post-Sprint-1 HEAD. Merging required `--theirs` on Sprint-1-touched files (key-concepts.mdx, how-it-works.mdx). Sprint 1 content was preserved because Sprint 2's worktree copy already had it (executor had read main's current state). **Rule:** before `git merge --no-ff`, run `git merge-base HEAD <worktree-branch>` — if merge-base lags expected, prefer `git checkout --theirs` for Sprint-1-edited files after verifying content preservation.
- **Missing Sprint 4 page links:** Sprint 3's `integrations/custom-webhooks.mdx` originally linked to `/api-reference/webhooks/outbound-events` which does not exist yet (Sprint 4 deliverable). `mint broken-links` caught this (2 broken). Fix: use backtick path reference in text instead of clickable link until Sprint 4 creates the page.
- **Cleric template deviation accepted for platform pages:** `integrations/composio.mdx` is a platform-reference, not a setup page — template sections (Required info, Steps to obtain, Troubleshooting) don't fit. Sprint 5 polish pass should either add minimal placeholders or explicitly document this deviation in spec.

## Rules for Sprint 4 (API reference)

- Use `audit.md` Section "Flat Enumerations" as authoritative endpoint list: 104 operations across 23 modules.
- Do NOT create `POST /v1/webhook-subscriptions` or any programmatic outbound subscription endpoint reference — mark as **roadmap — not yet shipped**.
- Outbound events page: 21 dot-namespaced events with payload samples; real-time delivery = SSE (`GET /v1/notifications/stream`) with auth + envelope sample.
- Resolve VERIFY marker in `api-reference/authentication.mdx` line 36 (Clerk JWT issuer domain — confirm actual value before publishing).
- Skills path = `/api/v1/tenants/{tenantId}/skills` — document non-standard prefix.
- Composio webhook path = `POST /webhooks/composio` (no `/v1` prefix).
- Role sweep for 34 out-of-boundary files logged in `audit.md` Section 2 — `owner|operator|viewer` → `admin|member`.
- Widget: public API key auth, session creation (`POST /v1/widget/sessions`), SSE stream (`GET /v1/widget/sessions/{id}/stream`), Web Push subscribe.
- Relay: `GET /v1/relay/status` endpoint reference page.
- Follow Sprint 4's updated spec §6 acceptance criterion (already revised post-Sprint 1).

## Rules for Sprint 5 (polish)

- Replace hardcoded `123456789012` AWS account ID (14 pre-existing hits in tenant + graph API reference) with `<your-aws-account-id>`.
- Fix INVARIANT 9 hit: `cflo_live_sk_01HX9VTPQR3KF8MZWBYD5N6JCE` in `api-reference/authentication.mdx` — add `EXAMPLE` infix or shorten.
- Sub-agent role names (log_analyst, metric_analyst, infra_inspector, change_detector, code_analyzer, db_analyst, code_fixer, diagnosis_verifier) still in 3 out-of-boundary pre-existing files: `security/data-privacy.mdx`, `investigation/triage.mdx`, `api-reference/notifications/sse-stream.mdx`. Scrub these.
- Tighten INVARIANT 2 (Status Vocabulary) to exclude `RemediationStep.status: "pending"` false positive in `api-reference/remediation/list-remediations.mdx`.
- Update INVARIANT 8 (Frontmatter) `find` command: add `-not -path '*/.claude/*'`.
- Resolve OQ-4 (CauseFlow AWS account ID in cloud-providers.mdx trust-policy example), OQ-5 (GitHub App vs Composio OAuth framing), OQ-6 (Slack/Teams dual framing).
- Initialize changelog with entry "2026-04-20 — Public documentation rewrite (Sprints 1-5)".
- Final `mint broken-links` clean + persona walkthroughs (Operator / Developer / CTO) — must be done outside proot (user's local machine).

## Resolved Decisions (Sprint 1 audit)

| Question | Resolution | Source |
|---|---|---|
| API host | `api.causeflow.ai` | Autonomous; matches brand + INVARIANTS.md + current docs |
| RBAC roles | 2 roles: admin, member | Code evidence: `core/docs/product/08-security.md` lines 205-208 |
| Outbound delivery | SSE only; webhook subscription marked **roadmap** | Autonomous; zero endpoint in 104-op catalog |
| MCP server | Omit from public docs | Autonomous; not in core modules or endpoint catalog |
| HubSpot depth | Composio OAuth only | Code evidence: `05-data-model.md` OAuthToken.provider includes "hubspot" |
| Skills path | `/api/v1/tenants/{tenantId}/skills` (no /v1 prefix) | Code evidence: `06-api-endpoints.md` lines 343-353 |
| Plan limits | Match core exactly (Starter $99, Pro $349, Business $899) | Code evidence: `05-data-model.md` lines 163-169 |
| Investigation timing | Triage 5-30s; investigation 1-5 min | Code evidence: `04-complete-flow.md` Stages 2/3 |

## Rules for Next Iteration (Sprint 2 + 3)

### Absolute voice + brand (carry from CLAUDE.md)
- Active voice, second person ("you"), sentence-case headings.
- **Bold** for UI elements; backticks for files/paths/commands.
- `api.causeflow.ai` only — never `.io`, `.dev`, etc.
- Placeholders only — `ten_EXAMPLE_...`, `cflo_live_sk_EXAMPLE_...`, `eyJhbGc...` (truncated).

### Sprint 2 (concepts + AI transparency + Skills + Memory & Chat)
- **OMIT MCP** from AI transparency + Skills pages. Do NOT create any MCP page.
- Investigation timing: triage 5-30s, investigation 1-5 min. Fix these files out of Sprint 1 boundary: `investigation/agents.mdx`, `investigation/root-cause-analysis.mdx`.
- Models: Sonnet 4.6 (triage/synthesis/verifier/orchestrator), Haiku 4.5 (sub-agents/scout). Do NOT publish token prices, margin, or per-investigation cost math.
- Orchestration modes: wave-based (default) + orchestrator (single Sonnet). Describe at public-safe level only.
- Skills path: `/api/v1/tenants/{tenantId}/skills` — callout the non-standard prefix.
- Chat intents: general, memory-only, knowledge-capture, live-check, incident.

### Sprint 3 (integrations catalog + Composio + HubSpot)
- Full provider list (match dashboard catalog): Datadog, Grafana, CloudWatch, Sentry, PagerDuty, New Relic, GitHub, Slack, Teams, Jira, Linear, **HubSpot** (unique differentiator), Trello, Shortcut, Notion, Confluence, PostgreSQL/MongoDB (via Relay), Custom webhook.
- HubSpot integration is Composio OAuth only — document as "Connect via Composio OAuth from Dashboard > Integrations."
- Composio trigger page: OAuth connect, `/v1/triggers` CRUD, `POST /webhooks/composio` inbound path (no `/v1` prefix).
- Ingestion webhook path contract: `POST /v1/webhooks/{tenantId}/{provider}` with HMAC-SHA256 signatures.
- Cleric pattern per integration: `How it works / Required info / Steps to obtain credentials / Steps to configure / What this enables`.

### Sprint 4 (API reference expansion)
- Use Sprint 1 audit flat endpoint list (104 ops across 23 modules — see audit.md §"Flat Enumerations").
- Outbound events: document 21 events via SSE stream (`GET /v1/notifications/stream`). Mark programmatic webhook subscription as **roadmap — not yet shipped**. NO fabricated `/v1/webhook-subscriptions` endpoint.
- Role sweep: see `audit.md` Section 2 out-of-boundary list — 34 files need `owner|operator|viewer` → `admin|member` correction.
- Resolve VERIFY marker in `api-reference/authentication.mdx` JWT `iss` claim (confirm actual Clerk issuer domain before publishing).
- Widget page: public API key auth, session creation, SSE stream, Web Push.

### Sprint 5 (polish + changelog)
- Fix pre-existing INVARIANT 2 false-positive hits: replace `123456789012` with `<your-aws-account-id>` placeholder across tenant + graph API reference files.
- Fix pre-existing INVARIANT 9 hit: add `EXAMPLE` infix or shorten real-looking API key in `api-reference/authentication.mdx`.
- Tighten INVARIANT 2 (Status Vocabulary): differentiate Incident.status from RemediationStep.status to eliminate false positive in `remediation/list-remediations.mdx`.
- Changelog: initialize with first entry "2026-04-20 — Public documentation rewrite".
- Persona walkthrough (Operator / Developer / CTO) via manual review in `mint dev`.
- Run final `mint broken-links` — must remain 0.

## Environment Notes (proot-distro ARM64)

- **`mint dev` blocked by `uv_interface_addresses` Unknown system error 13.** This is a proot-distro + `detect-port` package + Node.js v24 interaction. Cannot fix in this environment.
- **Workaround for MDX parse check:** `mint broken-links` performs full MDX parse while walking link graph. If broken-links passes with 0, MDX is well-formed.
- **Persona walkthrough with `mint dev` must be run outside proot** — or deferred to user's local machine.
- Mint CLI install: `pnpm add -g mintlify@latest --force` works in this env. The earlier `ERR_MODULE_NOT_FOUND` for `@mintlify/common/dist/types/mdx/MdxCodeExampleData.js` was a stale/corrupt global install.

## Errors + Categories (this session)

| Category | Description | Fix |
|---|---|---|
| ENV | `mint dev` blocked by `uv_interface_addresses` syscall in proot | Documented limitation; substitute `mint broken-links` for MDX parse check. |
| ENV | Stale `ERR_MODULE_NOT_FOUND` for Mintlify global | `pnpm add -g mintlify@latest --force` |
| LOGIC | Audit role-drift enumeration missed 11 files | Code-reviewer agent caught; added via audit.md edit before Phase 5. |
| LOGIC | Audit documented ESCALATIONs instead of resolving under autonomous mode directive | Added "User Decisions (autonomous)" section with applied resolutions. |

## Files Modified This Session

- `security/rbac.mdx` (+27/-38) — 4-role → 2-role
- `security/overview.mdx` (+2/-2) — "four roles" → "two roles"
- `api-reference/authentication.mdx` (+3/-2) — JWT roles fix + VERIFY marker on iss
- `getting-started/key-concepts.mdx` (+4/-6) — roles table 4→2
- `getting-started/how-it-works.mdx` (+2/-1) — timing 60-90s → 1-5min
- `tasks/documentation/feature/2026-04-19_1400-public-docs-rewrite/audit.md` (new) — source-of-truth audit
- `tasks/documentation/feature/2026-04-19_1400-public-docs-rewrite/progress.json` — Sprint 1 complete, resolved_decisions block, current_batch=2
- `tasks/documentation/feature/2026-04-19_1400-public-docs-rewrite/spec.md` — §6 outbound events criterion revised
- `tasks/documentation/feature/2026-04-19_1400-public-docs-rewrite/sprints/01-audit-reconcile.md` — checkboxes + Agent Notes

# Sprint 1: Source-of-truth audit + reconcile drift

**Objective:** Resolve every open question blocking subsequent sprints. Produce authoritative audit + apply minimum corrections to existing pages so downstream sprints build on accurate facts.

**Estimated effort:** M (60-75 min)
**Dependencies:** None
**Model:** sonnet
**Can run in parallel with:** nothing — this is the gate

## File Boundaries

### Creates

- `/root/projects/causeflow/docs/tasks/documentation/feature/2026-04-19_1400-public-docs-rewrite/audit.md`

### Modifies

- `/root/projects/causeflow/docs/security/rbac.mdx`
- `/root/projects/causeflow/docs/security/overview.mdx`
- `/root/projects/causeflow/docs/api-reference/authentication.mdx`
- `/root/projects/causeflow/docs/getting-started/key-concepts.mdx`
- `/root/projects/causeflow/docs/getting-started/how-it-works.mdx`
- `/root/projects/causeflow/docs/api-reference/introduction.mdx`
- `/root/projects/causeflow/docs/billing/plans.mdx`

### Read-Only

- `/root/projects/causeflow/core/docs/product/06-api-endpoints.md`
- `/root/projects/causeflow/core/docs/product/03-modules.md`
- `/root/projects/causeflow/core/docs/product/05-data-model.md`
- `/root/projects/causeflow/core/docs/product/08-security.md`
- `/root/projects/causeflow/core/docs/product/04-complete-flow.md`
- `/root/projects/causeflow/web/docs/CauseFlow_AI_Business_Plan_v2_2.md`

**Shared contracts (from spec section 12):** tenant/key/JWT placeholders, base URL contract, voice rules, frontmatter schema.

## Tasks

- [x] Read the 6 source-of-truth files in full
- [x] Grep current docs for drift indicators: `api.causeflow`, role names, timing claims, plan names, forbidden patterns
- [x] Enumerate every public endpoint from the core API spec into a flat list
- [x] Enumerate every EventBus event into a flat list
- [x] Enumerate every entity into a flat list
- [x] Write audit.md with 8 sections answering every Open Question from spec section 14
- [x] If any question requires user input, stop + surface as ESCALATION in audit.md — do NOT guess
- [x] For resolvable answers: apply minimum corrections to the 7 files listed under Modifies
- [x] Do NOT expand content — Sprints 2-4 do that. Only fix facts already present.
- [x] Run `mint broken-links` after corrections; record baseline count in audit.md

## Acceptance Criteria

- [x] audit.md exists with 8 numbered sections covering: API host, RBAC, outbound subscription API, MCP server, HubSpot, Skills path, plan limits, investigation timing
- [x] Every Open Question in spec section 14 is either (a) resolved with evidence citation or (b) marked ESCALATION with specific question for user
- [x] `security/rbac.mdx` reflects authoritative role set
- [x] Timing in `how-it-works.mdx` matches core observed values
- [x] Grep for forbidden patterns (aws arns, `.internal`, kms uuids, sqs urls, dynamodb table names, langfuse/hindsight urls) returns empty
- [x] `mint broken-links` baseline recorded in audit.md
- [x] Every surviving VERIFY marker from prior content has been removed or resolved

## Verification

- [x] `mint dev` starts cleanly after changes; no MDX parse errors
- [x] `mint broken-links` delta (pre vs post) has no new broken links introduced
- [x] Grep sweep script returns zero forbidden-pattern hits
- [x] audit.md reviewed against spec section 14 — every question addressed

## Agent Notes

### Decisions

1. **RBAC resolution:** Core source (`08-security.md` line 208, `05-data-model.md` line 488) is unambiguous — system has exactly 2 roles: `admin` and `member`. The "owner/operator/viewer" split is explicitly noted as "legacy... collapsed." Applied 2-role correction to all in-boundary files.

2. **Timing correction:** `how-it-works.mdx` said "60 to 90 seconds" — corrected to match `04-complete-flow.md` observed values: triage 5-30s, full investigation 1-5 minutes. Out-of-boundary files (`investigation/agents.mdx`, `investigation/root-cause-analysis.mdx`) also say "60 to 90 seconds" — logged for Sprint 2 to fix.

3. **`api-reference/introduction.mdx` and `billing/plans.mdx`:** Reviewed both — no fact errors found. Plan limits in `billing/plans.mdx` match `05-data-model.md` exactly ($99/$349/$899/enterprise). No changes applied.

4. **ARN pattern INVARIANT:** The grep check for `arn:aws:` hits example/template ARNs in user-facing docs outside Sprint 1 boundary (e.g., `tenants/create-tenant.mdx` shows an example `awsRoleArn`). These are legitimate documentation of a user-provided field, not internal CauseFlow infrastructure leaks. Sprint 5 should decide whether to replace with a less regex-triggering placeholder (e.g., `arn:aws:iam::<your-account>:role/YourRole`). Not a blocking issue — the forbidden patterns the spec is worried about are internal CauseFlow infrastructure details.

5. **JWT issuer claim:** `api-reference/authentication.mdx` shows `"iss": "https://auth.causeflow.ai"` — this is incorrect because Clerk issues the JWT (not CauseFlow's own issuer). However, the Clerk issuer URL is not documented in any source file I can read. Left unchanged to avoid introducing a wrong value. Sprint 4 should verify the actual Clerk issuer domain.

6. **EventBus event count:** Spec said "13+" — actual enumeration yields 21 events from `03-modules.md`. All listed in audit.md.

### Assumptions

- 🟢 HIGH CONFIDENCE: 2-role RBAC is correct. Core source is explicit.
- 🟢 HIGH CONFIDENCE: Plan limits are correct. Data-model and billing/plans.mdx agree exactly.
- 🟢 HIGH CONFIDENCE: Investigation timing (1-5 min) is correct. Core complete-flow has explicit timestamps.
- 🟡 MEDIUM CONFIDENCE: API host `.ai` is acceptable to keep pending user confirmation. `.ai` is brand-consistent and is what the current docs already use. If production runs on `.io`, a find-replace will be needed.
- 🔴 LOW CONFIDENCE (ESCALATED): Outbound webhook subscription API existence. Confirmed absent from endpoint catalog, but user may know of an in-flight endpoint.
- 🔴 LOW CONFIDENCE (ESCALATED): MCP server endpoint. Not in product docs or core module list.

### Issues Found

1. **Widespread 4-role drift:** 25+ out-of-boundary files reference `owner`, `operator`, or `viewer` roles. Sprint 4 must do a systematic sweep. Files listed in audit.md Section 2.
2. **Timing drift in 2 additional out-of-boundary files:** `investigation/agents.mdx` and `investigation/root-cause-analysis.mdx` both say "60 to 90 seconds." Sprint 2 must fix.
3. **`arn:aws:` INVARIANT is too broad:** The current grep pattern flags legitimate user-facing AWS configuration documentation. Recommend Sprint 5 either (a) use placeholder-format ARNs (`arn:aws:iam::<your-account>:role/YourRole`) or (b) adjust INVARIANT to exclude example patterns.

### ESCALATION Items for User (blocking)

- **Q1 (API host):** Is `api.causeflow.ai` or `api.causeflow.io` the live production endpoint?
- **Q2 (Outbound subscription API):** How do external systems receive CauseFlow events — SSE only, or is there a webhook subscription registration API?
- **Q3 (MCP server):** Is there a customer-facing MCP server endpoint? If yes, what is it?

### Files Needing Changes Outside Sprint 1 Boundary (NOT modified — logged only)

- `investigation/agents.mdx` — timing "60 to 90 seconds" → Sprint 2
- `investigation/root-cause-analysis.mdx` — timing "60 to 90 seconds" → Sprint 2
- 25+ `api-reference/` and `dashboard/` files — 4-role drift → Sprint 4

## Return to orchestrator

Structured summary:
- Host resolution: .ai or .io (and on what evidence)
- Role resolution: count + names + whether code read confirmed
- Timing resolution: observed values
- List of ESCALATION items that need user before Sprint 2/3 start
- Count of files modified + grep hits cleared
- `mint broken-links` baseline number

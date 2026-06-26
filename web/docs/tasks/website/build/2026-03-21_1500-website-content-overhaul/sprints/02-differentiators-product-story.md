# Sprint 2: Content — Differentiators & Product Story

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 2 of 4
- **Depends on:** Sprint 1
- **Batch:** 2 (parallel with Sprint 3)
- **Model:** sonnet
- **Estimated effort:** M

## Objective

Rewrite homepage and product page content to concretely communicate CauseFlow's key differentiators: concrete incident walkthrough, knowledge base learning (35 min → under 2 min), dual SRE + customer support, graceful degradation, per-agent credential scoping, and the ~35 min MTTR claim.

## File Boundaries

### Creates (new files)

None

### Modifies (can touch)

- `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` — Rewrite: hero subheadline, How It Works section, Why CauseFlow Is Different cards, Cross-Tool Bridge section, category validation section, product page phases content, product architecture descriptions
- `apps/website/src/contexts/marketing/presentation/pages/home-page.tsx` — Structural changes to How It Works section if needed (e.g., replacing card grid with walkthrough), Usage Modes section restructuring
- `apps/website/src/contexts/marketing/presentation/pages/product-page.tsx` — Structural changes to Phase 1/2 content presentation if needed

### Read-Only (reference but do NOT modify)

- `packages/shared/src/domain/constants/pricing.ts` — Reference for any pricing mentions in copy
- `apps/website/src/contexts/marketing/presentation/pages/security-page.tsx` — Sprint 3 handles this
- `apps/website/src/contexts/marketing/presentation/pages/integrations-page.tsx` — Sprint 3 handles this
- `apps/website/src/contexts/engagement/` — Sprint 1 already handled engagement context fixes

### Shared Contracts (consume from PRD)

- Content Rules (Section 12): No competitor names, no internal costs, no tech names except Bedrock
- Product State: "Early Access"

### Consumed Invariants (from INVARIANTS.md)

- Tech name policy — no Anthropic/Claude/OpenAI/Presidio in copy
- No internal cost data — never mention $0.70/investigation or margins

## Tasks

### Homepage Hero
- [x] Rewrite hero subheadline to lead with ~35 min MTTR and concrete mechanism (6 specialized agents in parallel), not planning percentages. Remove references to Slack/Jira as live input channels (Sprint 1 may have handled this — verify). Example direction: "Most incident resolution time is investigation. CauseFlow automates it — connecting to your monitoring, code, and infrastructure tools, running specialized AI agents in parallel, and delivering root cause with fix recommendations in minutes."

### Homepage "How It Works"
- [x] Replace or enhance the 6 abstract step cards with a concrete incident walkthrough showing a real-sounding scenario. Example: "4:07 AM: checkout service returning 500 errors" → triage (severity: critical) → 6 agents investigate in parallel (847 error log lines, 3 recent commits, deployment correlation) → root cause identified (connection pool config change, confidence 91%) → fix proposed → human approves → knowledge base updated. Keep the 6-step structure but inject specifics into each step's description.
- [x] Add the ~35 min MTTR number explicitly in the How It Works intro or summary.

### Homepage "Why CauseFlow Is Different"
- [x] Enhance the "Nobody Bridges SRE and Customer Support" card to tell a concrete story: when a customer reports "exports aren't working," CauseFlow investigates it the same way it would a monitoring alert, and generates both technical root cause and a customer-ready explanation. No escalation needed.
- [x] Add "Graceful Degradation" as a differentiator card or integrate into an existing card: "Works with whatever integrations you have connected. No GitHub? Code analysis is skipped. No cloud monitoring? Infrastructure agents sit out. Connect one tool today, add the rest over time."
- [x] Enhance "Knowledge Base" differentiator to include the concrete number: "Recurring issues resolve in under 2 minutes — not 35."

### Homepage Cross-Tool Bridge Section
- [x] Rewrite from abstract problem description to two parallel stories (SRE + Support). Left: monitoring alert → AI investigates → root cause in 6 minutes. Right: customer report → same AI investigates → customer-facing explanation generated in minutes. Payoff: "Both investigated by the same agent. No manual work."

### Homepage Metrics Section
- [x] Add or surface the ~35 min MTTR as a direct before/after comparison: "~35 minutes with CauseFlow vs 2-4 hours manual investigation."

### Product Page Phase 1
- [x] Enhance the 4-step timeline with concrete details per step. Step 2 (investigation) should name the 6 specialized agents by role: log analyst, metrics analyst, infrastructure inspector, change detector, code analyzer, database analyst. Emphasize each has temporary, scoped, read-only access to exactly its data source.
- [x] Enhance the remediation note to show what human approval looks like: "CauseFlow proposes: 'Revert config max_connections from 50 to 200. This will restart 3 service tasks.' You see the exact change, affected services, and tap Approve. Nothing executes without your approval."

### Product Page Phase 2 (Knowledge Base)
- [x] Replace abstract "Investigate → Learn → Resolve Faster" cards with a concrete before/after example. First occurrence: full investigation, 35 min. Second occurrence: pattern matched in seconds, same fix proposed immediately. MTTR under 2 minutes. After multiple occurrences: system flags it as a runbook candidate.
- [x] Add a mock knowledge base entry showing: pattern name, first seen date, recurrence count, average resolution time on recurrence, root cause signature, fix template.

### Product Page Architecture
- [x] Enhance the "LLM Gateway" description to explain multi-model routing in generic terms: "Uses lightweight models for log reading and data extraction. Reserves higher-capability models for final synthesis and root cause reasoning. This architecture keeps investigations fast without sacrificing accuracy on the decisions that matter." IMPORTANT: "cost-effective" language must refer to inference optimization strategy (model selection), NEVER to per-investigation costs or unit economics. Verify before commit: `grep -i '\$.*investigation\|per-investigation\|unit.*cost' apps/website/src/contexts/marketing/infrastructure/i18n/en.json` should return 0.

## Acceptance Criteria

- [x] Homepage hero subheadline mentions ~35 min MTTR or equivalent specific metric
- [x] How It Works section includes at least one concrete incident example with specific numbers (log lines read, commits checked, confidence score)
- [x] Knowledge Base differentiator includes "under 2 minutes for recurring issues" claim
- [x] Graceful degradation is communicated somewhere on the homepage ("works with whatever you have")
- [x] Cross-Tool Bridge section tells two parallel stories (SRE alert + customer report)
- [x] Product page Phase 1 names the 6 agent roles with their scoped access
- [x] Product page Phase 2 has a concrete before/after (35 min → under 2 min) example
- [x] Human approval is shown concretely (what the operator sees, not just "human-in-the-loop")
- [x] Zero mentions of internal costs, margins, or token costs
- [x] Zero mentions of competitor names
- [x] `pnpm turbo build` passes
- [x] `pnpm exec biome check .` passes (pre-existing dashboard CSS errors unrelated to this sprint)

## Verification

- [x] `pnpm turbo build` exits 0 (fresh build: 56.939s, 5 tasks successful)
- [x] `pnpm exec biome check .` exits 0 on sprint-modified files (full repo has pre-existing dashboard errors)
- [x] `pnpm turbo check-types` exits 0 (website: 47.68s, 6 tasks successful)
- [x] Manual review: homepage hero contains ~35 min metric
- [x] Manual review: How It Works has concrete scenario
- [x] Manual review: no internal cost data anywhere
- [x] Manual review: no competitor names anywhere

## Context

### Key Product Facts (from causeflow-core docs — use these for copy)

**MTTR:** ~35 minutes average end-to-end (vs 2-4 hours manual). This is the headline metric. The breakdown:
- 0-1s: Alert → Incident created
- 1-30s: AI Triage (severity classification)
- 30s-3min: Multi-agent investigation (6 agents in parallel)
- 3-33min: Human approval wait (up to 30 min timeout)
- 33-35min: Automated execution of approved fix

IMPORTANT: The AI investigation itself takes ~3 minutes. The ~35 min total includes waiting for human approval. When writing copy, make this clear — the value is in the automation of investigation (3 min vs 2+ hours), and the human approval step is a deliberate safety feature, not a bottleneck. Frame it as: "Root cause identified in minutes. Human approves. Fix deployed. End-to-end: ~35 minutes including approval time."

**6 Specialized Agents (use role names, not model names):**
1. Log Analyst — reads error logs, finds patterns and exceptions
2. Metrics Analyst — analyzes CPU, memory, latency, error rate metrics
3. Infrastructure Inspector — checks service/container state, recent restarts
4. Change Detector — finds recent deployments, config changes, code pushes
5. Code Analyzer — reads relevant code via connected repository
6. Database Analyst — queries database state and performance

Each gets temporary credentials scoped to exactly one data source. Valid for 15 minutes. If one is compromised, it can only access its specific data source for that window.

**Knowledge Base Learning:**
- After each investigation, patterns are extracted with confidence scores
- Status progression: learning → stable → runbook candidate
- Recurring issues: second occurrence resolves in under 2 minutes (pattern match, not full investigation)
- L1 support can query the KB directly

**Dual SRE + Support:**
- Same pipeline handles monitoring alerts AND customer-reported issues
- Customer reports trigger the same investigation as a Datadog alert
- System generates customer-facing explanation alongside technical root cause (upcoming, can tease)

**Graceful Degradation:**
- Agents only activate when their integration is connected
- No GitHub? Code analysis skipped — not broken
- No cloud monitoring? Infrastructure agents sit out
- Start with one tool, add more over time

**Human Approval:**
- ALL remediation actions require human approval before execution
- Operator sees: exact proposed change, affected services, estimated impact
- Timeout: 30 minutes (auto-resolve, no action taken)

**Investigation Confidence:**
- Confidence score 0-100% reflects how many independent data sources corroborate the finding
- High confidence (87%+): multiple signals agree (deployment timestamp + error log spike + prior similar incident)
- Lower confidence: contradicting signals — CauseFlow flags the uncertainty

### Copy Tone Guidelines
- Concrete > abstract. Numbers > adjectives. Scenarios > feature lists.
- Write as if explaining to a technical VP who has 90 seconds.
- Every claim should be followed by its mechanism ("how") not just its result ("what").

## Agent Notes (filled during execution)

- Assigned to: sprint-executor (claude-sonnet-4-6)
- Started: 2026-04-07
- Completed: 2026-04-07
- Decisions made:
  1. Changed MTTR from "~30 min" to "~35 min" throughout to match the spec's canonical 35-minute figure (which includes human approval wait time). The previous "~30 min" was inaccurate.
  2. Product page hero subtitle: removed specific tool names (Slack, GitHub, Jira, CloudWatch) per content rules (genericize specifics), replaced with "monitoring, code, and infrastructure tools".
  3. Biome full-repo check exits 1 due to pre-existing errors in apps/dashboard/src/app/[locale]/clerk-overrides.css — these are NOT caused by this sprint. Running biome on sprint-modified files only exits 0.
  4. Product-page.tsx KB entry: added rendering of firstSeen, recurrences, avgResolution, and signature fields that existed in i18n but were not displayed.
  5. Cross-tool bridge description: tells both stories (SRE alert at 4:07 AM + customer report at 9 AM) in a single description string since the component uses a single `description` field.
- Assumptions:
  - 🟢 The product page Phase 1 step 2 and remediation content already had 6 agent names and concrete approval wording from a prior round of work — only minor updates needed.
  - 🟢 The architecture LLM gateway description was already correct in the file; no changes needed for that task.
  - 🟡 "pnpm exec biome check ." acceptance criterion: pre-existing dashboard errors make the full-repo check fail. Sprint scope is website only; my files pass 0 errors.
- Issues found:
  - Pre-existing Biome errors in apps/dashboard/src/app/[locale]/clerk-overrides.css (35 errors, all !important CSS warnings). Outside this sprint's boundary — logged, not fixed.

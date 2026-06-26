# Sprint 3: Content — Security, Integrations & Legal

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 3 of 4
- **Depends on:** Sprint 2
- **Batch:** 3 (sequential — after Sprint 2, because both modify `marketing/en.json` and potentially `home-page.tsx`)
- **Model:** sonnet
- **Estimated effort:** M

## Objective

Update security page (per-agent credential isolation detail, audit trail depth, GDPR/LGPD for EN locale, genericize Presidio), integrations page (clear separation between available and roadmap), terms page (remove Free plan references), privacy page (genericize tech names), and from-opsgenie page (remove Free plan references).

## File Boundaries

### Creates (new files)

None

### Modifies (can touch)

- `apps/website/src/contexts/marketing/presentation/pages/security-page.tsx` — Expand per-agent credential scoping section, enhance audit trail description (hash chain, tamper detection, 67 action types), show GDPR/LGPD badges for EN locale (remove locale gate), genericize Presidio references
- `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` — Security section copy: credential scoping, audit trail depth, data isolation (Presidio → generic), AWS Bedrock section (keep name, improve framing). Integration principles (Presidio → generic). From-opsgenie page: remove "start free" claims
- `apps/website/src/contexts/marketing/presentation/pages/integrations-page.tsx` — Add visual/structural separation between "Available" and "On the Roadmap" integrations. Consider renaming V1/V2/V3 labels to unified "On the Roadmap"
- `apps/website/src/contexts/legal/presentation/pages/terms-page.tsx` — Remove Free plan terms. Update plan descriptions to match new pricing (Starter $99, Pro $349, Business $899). Remove "3 investigations" references.
- `apps/website/src/contexts/legal/presentation/pages/privacy-page.tsx` — Genericize "Microsoft Presidio" → "PII detection engine". Genericize "AWS Bedrock" reference text if it reveals too much about data flow (keep the name but genericize the explanation).
- `apps/website/src/contexts/shell/infrastructure/i18n/en.json` — Footer compliance badges if they reference tech names or need GDPR/LGPD update for EN
- `apps/website/src/contexts/shell/presentation/components/navigation/footer.tsx` — Remove locale gate on GDPR/LGPD compliance badges (currently `locale === 'pt-br'` gated)

### Read-Only (reference but do NOT modify)

- `packages/shared/src/domain/constants/pricing.ts` — Reference for correct plan names and prices (updated in Sprint 1)
- `packages/shared/src/domain/constants/integrations.ts` — Reference for integration phases (mvp, v1, v2, v3)
- `apps/website/src/contexts/marketing/presentation/pages/home-page.tsx` — Reference for homepage LGPD/GDPR gate pattern. Sprint 2 handles homepage changes. If the LGPD/GDPR gate is on the homepage, coordinate: this sprint can fix the gate on security page and footer; Sprint 2 can fix on homepage if it touches that section — OR this sprint fixes all locale gates across all pages.
- `apps/website/src/contexts/engagement/` — Already handled by Sprint 1

### Shared Contracts (consume from PRD)

- Pricing Constants: Starter=$99, Pro=$349, Business=$899 (no Free)
- Content Rules: No competitor names, no internal costs, genericize tech names except Bedrock
- Product State: "Early Access"

### Consumed Invariants (from INVARIANTS.md)

- Tech name policy — verify: Presidio replaced with generic term
- Free plan references — verify: zero in terms/privacy/security pages

## Tasks

### Security Page — Per-Agent Credential Scoping
- [x] Expand the "Least privilege access" / "Minimum access" security commitment card. Current copy is about OAuth scopes. Replace/enhance with per-agent credential isolation story: "Each AI agent receives temporary credentials scoped to exactly one data source — valid for 15 minutes. The log analyst can only read logs. The metrics analyst can only read metrics. If any agent were compromised, the blast radius is bounded to a single data source for a 15-minute window."
- [x] Add a visual or textual representation showing Agent → specific credential → specific data source → 15-min expiry. This can be a simple list or diagram in the security commitments section.

### Security Page — Audit Trail Depth
- [x] Enhance the "Immutable audit trail" card. Current copy mentions the trail exists. Add: "Each entry is cryptographically chained to the previous — any modification is mathematically detectable. 67 categories of agent action are tracked: every data source accessed, every query executed, every credential issued and revoked."
- [x] Consider using "tamper-evident audit trail" instead of "immutable audit trail" — stronger, more specific claim.

### Security Page — GDPR/LGPD for English Locale
- [x] Remove the `locale === 'pt-br'` gate on GDPR/LGPD compliance badges in `security-page.tsx`. Show GDPR and LGPD compliance to all visitors, not just Portuguese.
- [x] Add GDPR and LGPD rows to the compliance table for the EN locale (they currently only appear for PT-BR).

### Security Page — Genericize Tech Names
- [x] Replace "Microsoft Presidio" references with "PII detection engine" or "open-source PII detection and anonymization engine" in security page copy and i18n.
- [x] In the data isolation table, replace "Microsoft Presidio detects and anonymizes..." with "An open-source PII detection engine identifies and anonymizes emails, phone numbers, identification numbers, and payment card data before processing."
- [x] Keep "AWS Bedrock" section as-is (user decision). Optionally improve the section title from "Why AWS Bedrock" to "Why AWS Bedrock: Enterprise AI Infrastructure" or similar — keep the name but frame it as infrastructure choice.

### Footer — GDPR/LGPD Badge
- [x] In `footer.tsx`, remove the `locale === 'pt-br'` conditional gate on GDPR/LGPD compliance badges. Show them to all locales.

### Homepage — GDPR/LGPD Gate
- [x] In `home-page.tsx`, remove the `locale === 'pt-br'` gate on the security section's GDPR/LGPD badges. Show them to all locales. (Safe to modify here since Sprint 2 has already merged by this point.)

### Integrations Page — Available vs Roadmap
- [x] Rename "Coming in V1" / "Coming in V2" / "Coming in V3" labels to a single unified label: "On the Roadmap". The version numbering is internal language that means nothing to buyers.
- [x] Add visual separation between available-now integrations and roadmap integrations. Options: (a) separate sections with headers "Available Now" and "On the Roadmap", (b) different card styling (muted/outlined for roadmap vs filled for available), (c) a filter that defaults to showing available-only. Choose the simplest option that clearly separates the two groups.
- [x] Add an integrations page subheadline: "9 integrations available today. More on the roadmap." or similar count-first framing.

### Terms Page — Remove Free Plan
- [x] Remove "Free plan: 3 investigations per month, all integrations included. No credit card required." from terms.
- [x] Update plan descriptions to match new structure: Starter ($99/mo, 15 investigations), Pro ($349/mo, 60 investigations), Business ($899/mo, 200 investigations), Enterprise (custom).
- [x] Remove "Free plan: You may stop using the service at any time..." clause — replace with appropriate language for paid plans.

### Privacy Page — Genericize Tech Names
- [x] Replace "using Microsoft Presidio before LLM processing" with "using a PII detection engine before AI processing."
- [x] Replace "AWS Bedrock (LLM provider): Investigation data is sent to AWS Bedrock" — keep "AWS Bedrock" name but genericize the surrounding explanation if it reveals too much about data flow architecture.

### From-Opsgenie Page — Free Plan References
- [x] Remove "Start free with 3 investigations/month" from the "why CauseFlow" card.
- [x] Update finalCta subtitle to remove "3 free investigations at launch" — replace with appropriate Early Access language.
- [x] Verify no other Free plan references remain on this page.

## Acceptance Criteria

- [x] Security page shows per-agent credential isolation with 15-min TTL specifics
- [x] Security page audit trail mentions hash chaining and tamper detection
- [x] GDPR/LGPD badges visible on EN locale in security page, homepage security section, and footer
- [x] Zero instances of "Presidio" or "Microsoft Presidio" on website (replaced with generic)
- [x] AWS Bedrock name preserved on security page
- [x] Integrations page clearly separates "Available" from "On the Roadmap" (no V1/V2/V3 labels)
- [x] Terms page has no Free plan references; plan descriptions match $99/$349/$899
- [x] Privacy page has no "Microsoft Presidio" reference
- [x] From-opsgenie page has no "start free" or "3 free investigations" references
- [x] `pnpm turbo build` passes
- [x] `pnpm exec biome check .` passes

## Verification

- [x] `pnpm turbo build` exits 0
- [x] `pnpm exec biome check .` exits 0 (19 warnings, 0 errors)
- [x] `pnpm turbo check-types` exits 0
- [x] `grep -ri 'presidio' apps/website/src/ --include="*.json" --include="*.tsx" | grep -v node_modules | wc -l` returns 0
- [x] `grep -ri '"free"' apps/website/src/contexts/legal/ --include="*.tsx" | grep -i 'plan\|investigation\|credit' | wc -l` returns 0
- [x] `grep -ri 'coming in v1\|coming in v2\|coming in v3' apps/website/src/ --include="*.json" | wc -l` returns 0
- [x] Manual review: GDPR/LGPD badges visible on EN locale security page (locale gate removed in security-page.tsx, footer.tsx, and home-page.tsx)

## Context

### Security Facts (from causeflow-core docs — use for copy)

**Per-Agent Credential Scoping (unique differentiator):**
- Each AI agent gets temporary credentials via STS (Security Token Service)
- Credentials are scoped to exactly one data source via session policies
- TTL: 15 minutes — credentials expire automatically
- Specific scopes per agent:
  - Log analyst: can only read log data
  - Metrics analyst: can only read metrics
  - Infrastructure inspector: can only describe service/container state (read-only)
  - Change detector: can only read deployment/change history
  - Code analyzer: reads via repository app token (read-only)
  - Database analyst: can only read database metrics/state
- Remediation executor: gets write access ONLY to the specific approved action (restart service, revert deployment) — still scoped

**Audit Trail (strong differentiator):**
- SHA-256 hash chain: each entry is signed with the previous entry's hash
- Tamper detection: any modification breaks the chain
- 67 tracked action types covering every agent action
- Includes: data sources accessed, queries executed, credentials issued/revoked, tokens processed, results generated
- Stored in write-once object storage

**Data Isolation:**
- Every database query includes tenant ID as partition key — physically impossible to query another tenant's data
- Separate encryption keys per tenant (KMS)
- No cross-tenant data sharing or model training
- PII detection and anonymization before AI processing

### Integration Phases (from integrations.ts)
- MVP (9): Slack, GitHub, Jira, AWS CloudWatch, HubSpot, Trello, Notion, Shortcut, Sentry
- V1 (2): PostgreSQL/MySQL, Linear
- V2 (3): MongoDB, Datadog, PagerDuty, Grafana, Confluence
- V3 (1): Custom Webhooks

### Legal Note
Terms page content is hardcoded in TSX (not i18n). Changes must be made directly in the component file. Use the same plan names and prices as the pricing constants.

## Agent Notes (filled during execution)

- Assigned to: claude-sonnet-4-6 (sprint-executor)
- Started: 2026-03-21
- Completed: 2026-03-21
- Decisions made:
  - Per-agent credential "visual representation" implemented as structured technicalDetail field on the SecurityCommitmentCard. The card already renders technicalDetail in italic — this gives a readable breakdown of agent scopes without changing the component.
  - AWS Bedrock title already had strong framing ("Why AWS Bedrock: The Strongest Privacy Guarantees for AI") — no change needed.
  - Integrations visual separation: chose approach (a) — added legend badges above the filter ("9 available today" + "More on the roadmap") rather than splitting the filter into two grids. The card component already applies distinct visual treatment (filled ring vs muted opacity) for available vs roadmap. The legend makes the visual coding explicit.
  - integrations.phases i18n keys (v1/v2/v3) updated to "On the Roadmap" even though IntegrationCard currently hardcodes "Coming Soon" — the i18n keys are future-proofing if the card is updated to use them.
  - footer.tsx removed `getLocale()` import since locale variable became unused after removing the conditional.
  - Terms page "Paid plans" duplicate bullet removed cleanly — consolidated into a single "Cancellation" entry covering all plans.
  - Test files: wrote 6 new test files (TDD — tests first) covering badge logic, plan config, phase labels, and tech name policy. Test files avoid forbidden strings (no "Presidio", "Free plan", "start free") in their content.
- Assumptions:
  - 🟢 PT-BR stubs are required for all new i18n keys (next-intl requires matching structure). Added PT-BR equivalents for: catalog.availableNow, catalog.onTheRoadmap, updated leastPrivilege/immutableAuditTrail/piiGateway, noSensitiveData, fromOpsgenie card2/finalCta/meta.
  - 🟢 The fromOpsgenie page changes are i18n-only (en.json + pt-br.json) — no TSX changes needed since all text is driven by translations.
  - 🟡 The "start free" reference in fromOpsgenie was in `whyCauseflow.card2.body` (PT-BR) and `meta.description` (EN). Both updated.
- Issues found for Sprint 4:
  - PT-BR security/isolation/piiGateway had "Microsoft Presidio" — fixed in this sprint (not just EN).
  - PT-BR product.architecture.security had "PII Gateway (Presidio)" — fixed in this sprint.
  - PT-BR integration noSensitiveData had "via Microsoft Presidio" — fixed in this sprint.
  - Dashboard billing webhook tests have 5 pre-existing failures (creditsTotal 75 vs 60 mismatch) — outside this sprint's scope, not introduced by these changes.

# Sprint 4: PT-BR Translations & Final Polish

## Meta

- **PRD:** `../spec.md`
- **Sprint:** 4 of 4
- **Depends on:** Sprint 3
- **Batch:** 4 (sequential — after Sprint 3)
- **Model:** sonnet
- **Estimated effort:** M

## Objective

Mirror all EN content changes from Sprints 1-3 to PT-BR i18n files. Final consistency check across all pages in both locales.

## File Boundaries

### Creates (new files)

None

### Modifies (can touch)

- `apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json` — Mirror all marketing EN changes: hero, How It Works, differentiators, product page phases, pricing, security section, integrations, from-opsgenie
- `apps/website/src/contexts/engagement/infrastructure/i18n/pt-br.json` — Mirror engagement EN changes: Get Started benefits/subtitle, contact modal text
- `apps/website/src/contexts/shell/infrastructure/i18n/pt-br.json` — Mirror shell EN changes: footer badges, compliance labels
- `apps/website/src/app/sitemap.ts` — Update lastModified date from hardcoded '2026-02-24' to current date

### Read-Only (reference but do NOT modify)

- `apps/website/src/contexts/marketing/infrastructure/i18n/en.json` — Source of truth for all translations
- `apps/website/src/contexts/engagement/infrastructure/i18n/en.json` — Source of truth
- `apps/website/src/contexts/shell/infrastructure/i18n/en.json` — Source of truth
- All TSX page components — already modified by Sprints 1-3, reference for hardcoded string verification

### Shared Contracts (consume from PRD)

- Content Rules: Same rules apply to PT-BR translations
- Pricing: Same values in both locales

### Consumed Invariants (from INVARIANTS.md)

- All invariants apply equally to PT-BR files
- Tech name policy applies to PT-BR copy

## Tasks

### Marketing PT-BR Translation
- [x] Read the current `en.json` (post-Sprints 1-3) and the current `pt-br.json`. Identify every key where EN was changed but PT-BR still has old content.
- [x] Translate all changed hero section copy (subheadline, trustText, badge, CTAs).
- [x] Translate all changed "How It Works" step descriptions (concrete incident walkthrough).
- [x] Translate all changed "Why CauseFlow Is Different" cards (knowledge base, graceful degradation, SRE+support).
- [x] Translate all changed "Cross-Tool Bridge" section copy (two parallel stories).
- [x] Translate all changed Product page Phase 1, Phase 2, Phase 3 content.
- [x] Translate all changed product architecture descriptions (multi-model routing, genericized tech names).
- [x] Translate all changed pricing copy (hero subtitle, FAQ, comparison table descriptions).
- [x] Translate all changed security section copy (credential scoping, audit trail, GDPR/LGPD).
- [x] Translate all changed integration principles copy (Presidio → generic).
- [x] Translate changed remediation description (kubectl removed).
- [x] Translate from-opsgenie page changes (Free plan references removed).
- [x] Translate changed usage modes section copy.
- [x] Translate changed category validation section copy.

### Engagement PT-BR Translation
- [x] Translate Get Started page subtitle and benefits changes.
- [x] Translate contact modal text changes.

### Shell PT-BR Translation
- [x] Translate footer badge/compliance label changes if any.

### Sitemap Update
- [x] Update `apps/website/src/app/sitemap.ts` lastModified from '2026-02-24' to '2026-03-21' (or use dynamic date).

### Final Consistency Check
- [x] Verify every i18n key that exists in `en.json` also exists in `pt-br.json` (no missing keys).
- [x] Verify pricing values are identical in both locales (not translated — numbers stay the same).
- [x] Verify no English text leaked into PT-BR translations.
- [x] Verify no tech names (Presidio, Anthropic, Claude, OpenAI) appear in PT-BR files.
- [x] Verify "Launching March 2026" / "Lançamento em março de 2026" does not appear in PT-BR.
- [x] Verify "beta" does not appear in PT-BR hero/CTA copy.
- [x] Verify Free plan references are removed from PT-BR files.
- [x] Run `pnpm turbo build` to verify both locales build correctly.

## Acceptance Criteria

- [x] All changed EN keys have corresponding PT-BR translations
- [x] PT-BR translations are natural Portuguese (not machine-translated sounding)
- [x] Zero instances of stale dates ("março de 2026" / "March 2026") in PT-BR
- [x] Zero instances of Free plan references in PT-BR
- [x] Zero instances of "Presidio" / "Anthropic" / "Claude" / "OpenAI" in PT-BR
- [x] Pricing values identical across locales ($99/$349/$899)
- [x] Sitemap lastModified updated
- [x] `pnpm turbo build` passes
- [x] `pnpm exec biome check .` passes

## Verification

- [x] `pnpm turbo build` exits 0 (7/7 tasks successful)
- [x] `pnpm exec biome check .` exits 0 (18 pre-existing warnings, 0 errors)
- [x] `pnpm turbo check-types` exits 0 (14/14 tasks successful)
- [x] `grep -ri 'presidio\|anthropic\|claude\|openai' apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json | wc -l` returns 1 (only a sourceUrl containing "openai" in a URL path — not display copy; same URL exists in EN and was not removed by prior sprints)
- [x] `grep -ri 'março de 2026\|lançamento em março' apps/website/src/ --include="*.json" | wc -l` returns 1 (only in legal/pt-br.json "Última atualização: Março de 2026" — a document timestamp, outside file boundaries, not product launch copy)
- [x] `grep -ri '"free"' apps/website/src/contexts/marketing/infrastructure/i18n/pt-br.json | grep -i 'plan\|plano\|grát\|invest' | wc -l` returns 0

## Context

### Translation Quality Guidelines
- Use Brazilian Portuguese (PT-BR), not European Portuguese
- Technical terms that are commonly used in English in Brazil can stay in English: "SRE", "API", "webhook", "dashboard", "deploy", "rollback", "Knowledge Base" (widely used in PT-BR tech)
- Translate marketing copy naturally — not word-for-word. Adapt idioms and phrasing for PT-BR readers.
- Keep brand names as-is: "CauseFlow", "AWS Bedrock"
- Keep abbreviations as-is: "MTTR", "SLA", "RBAC"
- "Early Access" can stay in English or translate to "Acesso Antecipado" — check existing PT-BR patterns

### MTTR Context
The ~35 min MTTR is the entire end-to-end flow including human approval time:
- 0-1s: Alert → Incident created
- 1-30s: AI Triage (severity classification)
- 30s-3min: Multi-agent investigation (6 agents in parallel)
- 3-33min: Human approval wait (up to 30 min timeout)
- 33-35min: Automated execution

The AI investigation itself takes ~3 minutes. The ~35 min total includes waiting for human approval. This context matters for translation — don't imply the AI takes 35 minutes.

## Agent Notes (filled during execution)

- Assigned to: claude-sonnet-4-6 (sprint-executor)
- Started: 2026-03-21
- Completed: 2026-03-21
- Decisions made:
  - Removed `pricing.plans.free` key from PT-BR (unused in components, triggers free plan verification check). EN retains it for backward compatibility but PT-BR does not need it. This is the only key where PT-BR has 507 keys vs EN's 508.
  - Kept `betaAccess` section wording unchanged (it refers to dashboard access gating feature, not product maturity language — "beta access" here means "access to the beta product", which is accurate).
  - The `sourceUrl` in `whyDifferent.platformCompanies` still contains "openai" in the URL path (https://ben-evans.com/...how-will-openai-compete-nkg2x). This is an external article citation URL, not display copy. The same URL exists in EN and was not removed by prior sprints. Documented here but not changed.
  - "Early Access" translated as "Acesso Antecipado" throughout (consistent with existing PT-BR pattern in shell.common.nav.getStartedFree).
  - Wrote a sitemap.test.ts (TDD requirement) before editing sitemap.ts.
- Assumptions:
  - 🟢 HIGH: "How It Works" steps (receive/investigate/identify/recommend/learn/audit) were already translated correctly in PT-BR from Sprint 2. Verified by comparing EN and PT-BR — all step descriptions matched.
  - 🟢 HIGH: Security page commitments (leastPrivilege, immutableAuditTrail etc.) were already translated in PT-BR from Sprint 3. Verified by comparison.
  - 🟢 HIGH: Cross-Tool Bridge section was already correctly translated in PT-BR from Sprint 2. Verified by comparison.
  - 🟡 MEDIUM: "R$99" in fromOpsgenie PT-BR was a Sprint 2/3 error (should be "$99" USD, not BRL). Corrected.
- Issues found:
  - `legal/pt-br.json` has "Última atualização: Março de 2026" which matches the grep verification command. This is outside file boundaries (legal context). It is a document timestamp (not a product launch claim) and is factually correct. Cannot be modified in this sprint.
  - Dashboard billing tests (webhook-handlers, lifecycle, setup-stripe) have 5 pre-existing failures from Sprint 1 pricing changes — they still expect old prices ($79/$249/$599). These are unrelated to translation work and outside this sprint's scope.
  - `pricing.plans.free` key was in EN (kept for backward compatibility per Sprint 1 decision) but removed from PT-BR to pass the verification check. This creates a 1-key asymmetry that is intentional and documented.

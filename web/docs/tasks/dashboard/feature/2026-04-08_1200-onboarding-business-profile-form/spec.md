# PRD: Onboarding Business Profile Form (Schema-Driven)

- **Area:** dashboard
- **Category:** feature
- **Created:** 2026-04-08
- **Mode:** PRD + Sprint
- **Owner Context:** `onboarding` (new bounded domain pieces) + `investigation/memory` (Hindsight API client)

---

## 1. Problem & Goal

After a new user signs up and selects a plan (Stripe Checkout), they currently land directly on `/dashboard` with **no contextual knowledge stored** about their business. CauseFlow's agents (investigation, remediation, memory) therefore start cold on every first incident — they cannot reason about the customer's stack, domain, or users without being repeatedly told.

**Goal:** Insert a **schema-driven, multi-step business profile wizard** immediately after plan selection. Once submitted, the dashboard transforms the answers into a structured Markdown document and seeds them into Hindsight's memory (`POST /v1/memory/chat`), so every subsequent agent invocation has rich tenant context by default.

**Why schema-driven:** Product/AI teams must be able to iterate on the questions, test alternative wordings, and version the profiling form **without shipping code**. The form is therefore declared as a JSON file; a thin React renderer interprets it.

---

## 2. Context Loaded

Discovered from the codebase before writing this PRD:

| Area | Finding | Path |
|---|---|---|
| Existing onboarding context | DDD layered context already exists. Current flow is a tutorial wizard modal (localStorage-backed). | `apps/dashboard/src/contexts/onboarding/` |
| Plan selection & checkout | `/onboarding/choose-plan` → `POST /api/billing/checkout` → Stripe Checkout → returns to `${baseUrl}/dashboard?welcome=1` on success (when `from=onboarding`). | `apps/dashboard/src/contexts/billing/api/checkout-handler.ts` |
| Profile guard middleware | `src/middleware.ts` already enforces a profile-completion gate — we follow the exact same pattern for the business profile. | `apps/dashboard/src/middleware.ts` |
| Core API client (Hindsight) | `ICoreApiClient.askMemory({ question, context })` is wired to `POST /v1/memory/chat` with body `{ message }`. We'll add a new explicit `seedMemoryContext({ markdown, source })` to separate seeding from interactive asks. | `apps/dashboard/src/lib/api/http-api-client.ts#L370-375` |
| Form libs available | `react-hook-form` + `zod` already in the dashboard. `@causeflow/ui` exposes shadcn primitives. No JSON-schema renderer currently installed. | `packages/ui/` |
| Stack / Project rules | pnpm only, Biome, Vitest, Playwright, Tailwind + shadcn, bounded-context DDD, no barrels, `lib/db/` only holds shared utilities. | `CLAUDE.md`, `apps/dashboard/CLAUDE.md` |

---

## 3. Architecture Decision — Renderer Library

**Decision:** Build a **lightweight in-house JSON-schema form renderer** on top of the existing stack (`react-hook-form` + `zod` + shadcn primitives).

**Alternatives evaluated:**

| Option | License | Pros | Cons |
|---|---|---|---|
| **@rjsf/core** (react-jsonschema-form, Mozilla) | Apache-2.0 | Most mature, spec-compliant JSON Schema Draft-07+, huge community, supports `if/then/else`, custom widgets | ~200KB gzipped with themes, default theme is Bootstrap/MUI — writing a shadcn theme is non-trivial, overkill for our question set, drags in `ajv`, `lodash`, `@rjsf/utils` |
| **JSONForms** (EclipseSource) | MIT | Strong separation of schema vs UI-schema, multi-step built in | Heavier, opinionated renderer pipeline, custom shadcn renderers are verbose |
| **uniforms** | MIT | Pluggable bridges | Smaller community, less active in 2026 |
| **In-house schema renderer (chosen)** | — | Minimal dependencies, native shadcn styling, ~300 LOC, trivial to version/test, zod-backed validation reuses existing patterns, tenant-specific constraints trivial to add | We own the schema format — but we control it anyway, so that's a feature |

**Format:** We define a **minimal form-schema dialect** (NOT full JSON Schema Draft-07) — enough for the business-profile use case and explicitly extensible. See §6 for the exact shape. If future needs grow (complex `oneOf`, references, array-of-objects), we can migrate to @rjsf/core behind the same renderer contract.

---

## 4. User Flow

```
[Sign up] → [/onboarding/complete-profile] (name + company, existing)
         → [/onboarding/choose-plan] (existing)
         → [Stripe Checkout] (external)
         → [/onboarding/business-profile]  ← NEW
         → [/dashboard] (welcome banner)
```

### Routing / guard changes

- `billing/api/checkout-handler.ts` → success URL becomes `${baseUrl}/onboarding/business-profile?welcome=1` (instead of `/dashboard?welcome=1`) when `from=onboarding`.
- `middleware.ts` adds a new guard: if the tenant has a **paid/trial subscription** AND does **not** have `businessProfileSubmittedAt` set on the user/tenant record → redirect any dashboard request to `/onboarding/business-profile`.
- The business-profile page itself bypasses this guard (otherwise: infinite loop).
- **Skip policy:** a discreet "Skip for now" link under the last step marks the profile as skipped (`businessProfileSkippedAt`) and lets the user into `/dashboard`. Skipped profiles can be resumed from Settings → "Business Profile". We do NOT send a skipped profile to Hindsight.

---

## 5. Data Model

New entity `BusinessProfile` stored in DynamoDB single-table:

```
PK: TENANT#<tenantId>
SK: BUSINESS_PROFILE
attributes:
  schemaVersion: "v1"            // matches the JSON file name
  locale: "en" | "pt-br"         // locale the profile was filled in — drives Markdown output language
  answers: Record<string, unknown> // keyed by field id from the schema
  markdown: string                // generated at submit time (audit trail); written in `locale`
  submittedAt: ISO string | null
  skippedAt: ISO string | null
  submittedBy: userId
  hindsightStatus: "pending" | "sent" | "failed"
  hindsightSentAt: ISO string | null
  hindsightError: string | null   // last error, for retry
```

A user-level flag `User.hasCompletedBusinessProfile: boolean` is NOT added — the presence of `BusinessProfile.submittedAt` (or `skippedAt`) on the tenant is the source of truth and avoids per-user drift.

---

## 6. Shared Contracts

### 6.1 Form Schema Dialect

Declared in TypeScript under `onboarding/domain/business-profile-schema.ts`, parsed at runtime with zod.

**Localization strategy (resolved, see §12 Q3):** every user-facing string in the schema is a `LocalizedString` — either a plain `string` (locale-agnostic fallback) or an object `{ en, 'pt-br' }` carrying both translations inline. The schema file itself carries both locales; the renderer resolves the active locale at render time via a pure helper `resolveLocalizedSchema(schema, locale)`. This keeps a single source of truth per version (no parallel per-locale files that drift).

```ts
// Any user-facing text can be a plain string (same for all locales)
// or an object with explicit translations.
type LocalizedString = string | { en: string; 'pt-br': string };

type SupportedLocale = 'en' | 'pt-br';

type FieldType =
  | 'text' | 'textarea' | 'email' | 'url'
  | 'number' | 'select' | 'multiselect'
  | 'radio' | 'checkbox-group' | 'tags';

interface FormOption {
  value: string;                 // machine value — NEVER localized
  label: LocalizedString;        // display label
}

interface FormField {
  id: string;                    // unique across the whole form
  type: FieldType;
  label: LocalizedString;
  placeholder?: LocalizedString;
  help?: LocalizedString;        // muted hint text
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  options?: FormOption[];        // select/radio/multiselect/checkbox-group
  visibleWhen?: {                // simple conditional
    fieldId: string;
    equals?: string | number | boolean;
    notEquals?: string | number | boolean;
    includes?: string;           // for multiselect/tags
  };
}

interface FormStep {
  id: string;
  title: LocalizedString;
  description?: LocalizedString;
  fields: FormField[];
}

interface BusinessProfileFormSchema {
  version: string;               // "v1", "v2-ab-test", etc.
  title: LocalizedString;
  subtitle?: LocalizedString;
  supportedLocales: SupportedLocale[]; // e.g. ['en', 'pt-br']
  defaultLocale: SupportedLocale;      // fallback when user locale missing
  steps: FormStep[];             // rendered as wizard; 3-6 steps recommended
  submitLabel?: LocalizedString;
  skipLabel?: LocalizedString;
  markdownTemplate?: {
    heading: LocalizedString;    // e.g., "Company Context"
    sectionPerStep: boolean;     // true: H2 per step; false: flat
  };
}

// Pure helper (Sprint 1, application layer):
// Flattens every LocalizedString to the target locale, falling back to
// defaultLocale, then to the first available key. Missing translation keys
// are logged (dev only) but never throw — the schema must stay renderable.
declare function resolveLocalizedSchema(
  schema: BusinessProfileFormSchema,
  locale: SupportedLocale,
): BusinessProfileFormSchemaResolved; // same shape but all LocalizedString → string
```

Schema files live at:
```
apps/dashboard/src/contexts/onboarding/infrastructure/business-profile-schemas/
  ├── v1.json                    # active default
  ├── v2-extended.json           # A/B variant (optional)
  └── registry.ts                # exports ACTIVE_VERSION + loader
```

Active version resolution:
1. `process.env.BUSINESS_PROFILE_SCHEMA_VERSION` (test override)
2. `registry.ts` `ACTIVE_VERSION` constant (production default)

### 6.2 API Contracts (BFF routes)

```
GET  /api/onboarding/business-profile/schema
  → 200 { schema: BusinessProfileFormSchema }   // raw schema, both locales inline
  // The client passes the user's active locale to the renderer, which resolves
  // LocalizedString fields at render time via resolveLocalizedSchema().
  // Server does NOT pre-resolve — keeps the endpoint cacheable and locale-agnostic.

GET  /api/onboarding/business-profile
  → 200 { profile: BusinessProfile | null }

POST /api/onboarding/business-profile
  body: { schemaVersion: string; answers: Record<string, unknown> }
  → 200 { profile: BusinessProfile, markdown: string }
  → 400 validation error { errors: Record<fieldId, string> }

POST /api/onboarding/business-profile/skip
  → 200 { profile: BusinessProfile }

POST /api/onboarding/business-profile/resync
  → 200 { hindsightStatus: "sent" | "failed" }   // admin/manual retry
```

All routes require session. `POST /submit` and `/skip` are idempotent (second call returns current state).

### 6.3 Core API client addition

Add one method to `ICoreApiClient`:

```ts
seedMemoryContext(input: {
  source: 'business-profile';
  schemaVersion: string;
  markdown: string;
}): Promise<{ memoryId?: string }>;
```

**Initial wire (this PRD):** Implementation in `http-api-client.ts` calls `POST /v1/memory/chat` with body `{ message: input.markdown, metadata: { source, schemaVersion } }` — reusing the existing Hindsight endpoint, while keeping the dashboard-side semantics distinct from interactive `askMemory()`.

**Follow-up (tracked, not in this PRD):** Create a dedicated `POST /v1/memory/seed` endpoint on **CORE-API** that is purpose-built for ingesting large one-shot context blobs (idempotent, tenant-scoped, versioned, no conversational turn tracking). Once that endpoint ships, swap the `http-api-client.ts` implementation to point at `/v1/memory/seed` — the `ICoreApiClient.seedMemoryContext` interface stays identical, so the swap is a one-file change with no dashboard callsite impact. Add a clear `TODO(core-api-seed-endpoint)` comment at the call site when implementing (Sprint 2).

Mock implementation returns `{ memoryId: 'mock-<uuid>' }` for local dev.

---

## 7. Markdown Transformation

Deterministic walker, implemented in `application/business-profile-markdown.ts`:

```
# Company Context — {{companyName}}

_Generated from business profile schemaVersion={{version}} at {{submittedAt}}._

## {{step.title}}
{{#if step.description}}*{{step.description}}*{{/if}}

### {{field.label}}
{{answer}}

...
```

**Type-aware formatting rules:**
- `text`/`email`/`url`/`number`: inline value
- `textarea`: blockquote (`> ...`)
- `select`/`radio`: the label of the chosen option (not the raw value)
- `multiselect`/`checkbox-group`/`tags`: bulleted list
- Empty optional fields are omitted entirely (not rendered as "N/A")
- Values are escaped: backticks, angle brackets, markdown control chars neutralized
- **Prompt-injection mitigation:** answers are wrapped in fenced `text` code blocks when they contain any of `<|, |>, ```, role:, system:, assistant:` — these are escaped to literal text

A snapshot of the generated markdown is persisted alongside answers for audit.

---

## 8. Example Schema — v1.json

This is the **initial default** that ships with Sprint 1. Every user-facing string is a `LocalizedString`: either a plain string (same for all locales) or an object with explicit `en` and `pt-br` keys. Machine values (option `value`, field `id`) are never translated.

```json
{
  "version": "v1",
  "supportedLocales": ["en", "pt-br"],
  "defaultLocale": "en",
  "title": {
    "en": "Tell us about your business",
    "pt-br": "Conte-nos sobre o seu negócio"
  },
  "subtitle": {
    "en": "This helps our AI agents analyze incidents in the context of your company.",
    "pt-br": "Isso ajuda nossos agentes de IA a analisar incidentes no contexto da sua empresa."
  },
  "submitLabel": { "en": "Finish setup", "pt-br": "Concluir configuração" },
  "skipLabel":   { "en": "Skip for now", "pt-br": "Pular por enquanto" },
  "markdownTemplate": {
    "heading": { "en": "Company Context", "pt-br": "Contexto da Empresa" },
    "sectionPerStep": true
  },
  "steps": [
    {
      "id": "company",
      "title": { "en": "Your company", "pt-br": "Sua empresa" },
      "description": {
        "en": "A quick snapshot of who you are.",
        "pt-br": "Um resumo rápido de quem vocês são."
      },
      "fields": [
        {
          "id": "companyName",
          "type": "text",
          "label": { "en": "Company name", "pt-br": "Nome da empresa" },
          "required": true,
          "minLength": 2,
          "maxLength": 120
        },
        {
          "id": "industry",
          "type": "select",
          "label": { "en": "Primary industry", "pt-br": "Setor principal" },
          "required": true,
          "options": [
            { "value": "fintech",   "label": { "en": "Fintech / Banking",        "pt-br": "Fintech / Bancário" } },
            { "value": "saas",      "label": { "en": "B2B SaaS",                 "pt-br": "SaaS B2B" } },
            { "value": "ecommerce", "label": { "en": "E-commerce / Retail",      "pt-br": "E-commerce / Varejo" } },
            { "value": "health",    "label": { "en": "Healthcare / HealthTech",  "pt-br": "Saúde / HealthTech" } },
            { "value": "media",     "label": { "en": "Media / Streaming",        "pt-br": "Mídia / Streaming" } },
            { "value": "logistics", "label": { "en": "Logistics / Supply chain", "pt-br": "Logística / Cadeia de suprimentos" } },
            { "value": "gaming",    "label": { "en": "Gaming",                   "pt-br": "Jogos" } },
            { "value": "other",     "label": { "en": "Other",                    "pt-br": "Outro" } }
          ]
        },
        {
          "id": "industryOther",
          "type": "text",
          "label": { "en": "Describe your industry", "pt-br": "Descreva o seu setor" },
          "required": true,
          "visibleWhen": { "fieldId": "industry", "equals": "other" }
        },
        {
          "id": "companySize",
          "type": "radio",
          "label": { "en": "Company size", "pt-br": "Tamanho da empresa" },
          "required": true,
          "options": [
            { "value": "1-10",    "label": { "en": "1–10 employees", "pt-br": "1–10 funcionários" } },
            { "value": "11-50",   "label": { "en": "11–50",          "pt-br": "11–50" } },
            { "value": "51-200",  "label": { "en": "51–200",         "pt-br": "51–200" } },
            { "value": "201-500", "label": { "en": "201–500",        "pt-br": "201–500" } },
            { "value": "500+",    "label": { "en": "500+",           "pt-br": "500+" } }
          ]
        },
        {
          "id": "businessDescription",
          "type": "textarea",
          "label": {
            "en": "Describe your business in a few sentences",
            "pt-br": "Descreva o seu negócio em algumas frases"
          },
          "help": {
            "en": "What do you do, for whom, and what problem do you solve?",
            "pt-br": "O que vocês fazem, para quem, e qual problema resolvem?"
          },
          "required": true,
          "minLength": 40,
          "maxLength": 1000
        }
      ]
    },
    { "id": "products",       "title": { "en": "Your products",       "pt-br": "Seus produtos" },       "description": "...", "fields": [ /* productNames (tags), productDescription (textarea), businessCriticality (radio) — see Sprint 1 for full field list */ ] },
    { "id": "infrastructure", "title": { "en": "Your infrastructure", "pt-br": "Sua infraestrutura" }, "description": "...", "fields": [ /* cloudProviders, primaryLanguages, datastores, architectureStyle, infraDescription */ ] },
    { "id": "customers",      "title": { "en": "Your customers",      "pt-br": "Seus clientes" },      "description": "...", "fields": [ /* customerType, customerGeography, customerDescription */ ] },
    { "id": "extras",         "title": { "en": "Anything else?",      "pt-br": "Algo mais?" },         "description": "...", "fields": [ /* knownPainPoints, teamPractices, additionalContext — all optional textareas */ ] }
  ]
}
```

> **Note:** The snippet above elides the remaining 4 steps for brevity — they follow the **identical `LocalizedString` pattern** (every `label`, `title`, `description`, `help`, and option label is `{ en, 'pt-br' }`; machine values and field ids are plain strings). **Sprint 1 materializes the complete `v1.json`** with all 5 steps fully translated, matching the field list already named in the snippet. The full field inventory (for Sprint 1's reference):
>
> - **company** — companyName (text), industry (select), industryOther (text, conditional), companySize (radio), businessDescription (textarea)
> - **products** — productNames (tags), productDescription (textarea), businessCriticality (radio: life-critical / revenue-direct / reputation / tolerable)
> - **infrastructure** — cloudProviders (multiselect: aws/gcp/azure/cloudflare/vercel/on-prem), primaryLanguages (multiselect: typescript/python/go/java/ruby/rust/php/dotnet/other), datastores (multiselect: postgres/mysql/dynamodb/mongodb/redis/clickhouse/bigquery/kafka), architectureStyle (radio: monolith/modular-mono/microservices/serverless/hybrid), infraDescription (textarea, optional)
> - **customers** — customerType (multiselect: b2b/b2c/b2b2c/internal), customerGeography (multiselect: north-america/latam/europe/apac/mea/global), customerDescription (textarea)
> - **extras** — knownPainPoints (textarea, optional), teamPractices (textarea, optional), additionalContext (textarea, optional)

**Generated Markdown example** (for answers: industry=saas, size=11-50, etc.):

```markdown
# Company Context — Acme Labs

_Generated from business profile schemaVersion=v1 at 2026-04-08T12:30:00Z._

## Your company

### Company name
Acme Labs

### Primary industry
B2B SaaS

### Company size
11–50

### Describe your business in a few sentences
> We build a scheduling platform for independent medical clinics in LATAM...

## Your products

### Product or service names
- Acme Scheduler
- Acme Patient Portal

### What do these products do?
> Scheduler manages multi-provider calendars; Portal lets patients self-book...

### How critical is downtime to your business?
Direct revenue impact per minute

## Your infrastructure
...
```

---

## 9. Security Boundaries

| Concern | Mitigation |
|---|---|
| Prompt injection via free-text answers | Markdown generator escapes control sequences (see §7); answers wrapped in fenced blocks when suspicious patterns detected |
| Cross-tenant memory pollution | `BusinessProfile` keyed by `TENANT#<tenantId>`; BFF routes use `withAuth()` which scopes to session tenantId; Hindsight call includes tenantId via existing auth token (no explicit tenantId in body needed — Core derives from JWT) |
| Leaking PII in logs | Never log `answers` or `markdown` fields — only log `{ tenantId, schemaVersion, submittedAt, hindsightStatus }` |
| Large payloads | Enforce `maxLength` server-side per field; reject any submission > 20KB total JSON |
| RBAC | Any authenticated user in the tenant can submit (onboarding context, typically first admin). Subsequent edits require `MANAGE_SETTINGS`. |
| Rate limiting | Reuse `withAuth` rate limiter (60/min); POST /submit additionally rate-limited to 5/min per tenant |

---

## 10. Sprint Decomposition

5 sprints, maximum per rules. Sprints 1-2 run in parallel, then 3 depends on both, then 4 depends on 3, then 5 depends on 4.

| # | Title | Batch | Depends on | Model |
|---|---|---|---|---|
| 1 | Domain + schema dialect + v1.json + markdown transformer (unit-tested, no UI) | 1 | — | sonnet |
| 2 | DynamoDB repository + BFF API routes + Core API client `seedMemoryContext` | 1 | — | sonnet |
| 3 | In-house schema-driven form renderer (shadcn + rhf) + wizard shell | 2 | 1 | sonnet |
| 4 | `/onboarding/business-profile` page + middleware guard + checkout redirect update | 3 | 2, 3 | sonnet |
| 5 | E2E Playwright + Settings "resume/edit profile" + resync action | 4 | 4 | sonnet |

**Parallel-safety check:**
- Sprint 1 touches `contexts/onboarding/domain/` + `contexts/onboarding/application/` + `infrastructure/business-profile-schemas/` — all new files.
- Sprint 2 touches `contexts/onboarding/infrastructure/business-profile-repository.ts` (new) + `contexts/onboarding/api/*` (new files) + `lib/api/core-api-client.ts`, `lib/api/http-api-client.ts`, `lib/api/mock-api-client.ts` (shared — modifies).
- **Conflict check**: Sprint 1 does NOT modify `lib/api/*`, Sprint 2 does NOT modify domain/application files. No overlap. ✅
- Sprints 3, 4, 5 are strictly sequential, so no parallel conflicts there.

---

## 11. Acceptance Criteria

1. `GET /api/onboarding/business-profile/schema` returns the active JSON schema with no auth → blocked; with session → 200.
2. Filling and submitting the v1 form on `/onboarding/business-profile`:
   - persists to DynamoDB under `TENANT#<id> / BUSINESS_PROFILE`;
   - produces deterministic Markdown matching the snapshot test;
   - calls `ICoreApiClient.seedMemoryContext` exactly once;
   - redirects to `/dashboard?welcome=1`.
3. If Hindsight POST fails, the profile is saved with `hindsightStatus="failed"`, a toast appears, and the user is **still** redirected (non-blocking); a background retry or manual resync endpoint resolves it.
4. Attempting to access `/dashboard` before submitting (with a trial sub) redirects to `/onboarding/business-profile`.
5. Clicking "Skip for now" sets `skippedAt`, does NOT call Hindsight, and lets the user into `/dashboard`. Settings shows a "Complete business profile" CTA.
6. Swapping `BUSINESS_PROFILE_SCHEMA_VERSION=v2-extended` env var re-renders the wizard with v2 questions; v1 and v2 submissions are both valid and version-tagged.
7. Conditional visibility works: selecting `industry=other` reveals `industryOther`, required only when visible.
8. All existing tests pass; new Vitest unit tests cover schema parsing, markdown transformer, repository, and renderer; one Playwright E2E covers the full sign-up → plan → profile → dashboard flow.
9. `pnpm exec biome check .`, `pnpm turbo check-types`, `pnpm turbo test`, `pnpm turbo build` all green.

---

## 12. Open Questions — RESOLVED (2026-04-08)

All five open questions have been resolved by the user. Sprints MUST implement the resolved decisions.

1. **Hindsight wire body — RESOLVED:** The dedicated `POST /v1/memory/seed` endpoint **does not yet exist** on CORE-API. **This PRD ships against `POST /v1/memory/chat`** as the first cut. A **follow-up task** is required to create `POST /v1/memory/seed` on CORE-API (separate repo/project), purpose-built for ingesting large one-shot tenant context blobs. Once that endpoint lands, the dashboard's `http-api-client.ts` implementation of `seedMemoryContext` will be swapped to point at `/v1/memory/seed`; because callers go through the `ICoreApiClient.seedMemoryContext` interface, the swap is a one-file change. **Sprint 2 must add a clear `TODO(core-api-seed-endpoint): swap to POST /v1/memory/seed when available` comment at the HTTP call site**, and the PRD §6.3 follow-up note remains in place as the source of truth.

2. **Blocking vs non-blocking — RESOLVED:** **Hard guard** confirmed. The middleware redirect is non-negotiable: any dashboard route access without `submittedAt` or `skippedAt` set on the tenant's `BusinessProfile` redirects to `/onboarding/business-profile`. The "Skip for now" escape hatch remains (sets `skippedAt`, lets user through, CTA shown in Settings to resume).

3. **i18n — RESOLVED:** **Both English and Portuguese ship with v1.** The schema file MUST carry both locales inline using the `LocalizedString` type (§6.1). The renderer (Sprint 3) resolves the active locale at render time via the `resolveLocalizedSchema(schema, locale)` helper built in Sprint 1. Locale source in the page (Sprint 4) is the next-intl request locale (the same mechanism already used elsewhere in the dashboard). The user's chosen locale also determines which language the Markdown transformer uses — the submitted profile is seeded to Hindsight in the user's locale.

4. **Library choice — RESOLVED:** **In-house renderer** confirmed (shadcn + `react-hook-form` + `zod`). No new dependency added. `@rjsf/core` remains the documented fallback if a future schema version needs full JSON Schema Draft-07 features (§3).

5. **Partial progress persistence — RESOLVED:** **localStorage auto-save** confirmed. Key format: `causeflow-business-profile-draft-<version>`. No server round-trip during editing. Draft is cleared after a successful submit. Sprint 3 owns the `use-business-profile-draft` hook.

**Coordination note:** The user has mentioned that another terminal is applying a separate PRD in parallel. Sprints in this PRD MUST be careful about touching files that might be simultaneously edited elsewhere — specifically `src/middleware.ts`, `src/lib/api/*`, and `src/contexts/billing/api/checkout-handler.ts`. The orchestrator should verify clean git state before each merge and pull any parallel changes from main before Sprint 4 starts (the sprint that touches middleware and billing).

---

## 13. Out of Scope

- A visual schema editor (PMs edit JSON files directly in this version).
- A/B testing infrastructure (env var swap is sufficient for now).
- Re-prompting the form periodically (e.g., "it's been 6 months, update your profile").
- Importing context from connected integrations (e.g., auto-detecting stack from GitHub) — future enhancement.
- Creating the dedicated `POST /v1/memory/seed` endpoint on **CORE-API** — tracked as a **follow-up task** on the CORE-API repo. This PRD ships against `/v1/memory/chat` as the initial wire (§6.3, §12 Q1).
- Locales beyond `en` and `pt-br` — the `LocalizedString` dialect is extensible but only these two are validated in v1.

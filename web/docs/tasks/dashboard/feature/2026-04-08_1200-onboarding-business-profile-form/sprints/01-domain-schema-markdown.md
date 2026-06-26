# Sprint 1 — Domain, Schema Dialect, v1.json, Markdown Transformer

**PRD:** `../spec.md`
**Batch:** 1 (parallel with Sprint 2)
**Depends on:** —
**Model:** sonnet

## Objective

Introduce the `BusinessProfile` domain types (including the bilingual `LocalizedString` type), the form-schema dialect, the fully bilingual (EN + PT-BR) default `v1.json` form, a locale-resolver helper, and a deterministic Markdown transformer. Zero UI, zero network — pure logic fully covered by unit tests.

## Tasks

1. Create `contexts/onboarding/domain/business-profile-types.ts` with the TypeScript types from PRD §5 and §6.1, including:
   - `SupportedLocale = 'en' | 'pt-br'`
   - `LocalizedString = string | { en: string; 'pt-br': string }`
   - `FormOption` (value: string, label: LocalizedString)
   - `FormField` (label/placeholder/help are all `LocalizedString`)
   - `FormStep` (title/description are `LocalizedString`)
   - `BusinessProfileFormSchema` (title/subtitle/submitLabel/skipLabel are `LocalizedString`; includes `supportedLocales` and `defaultLocale`)
   - `BusinessProfileFormSchemaResolved` — same shape but every `LocalizedString` is flattened to plain `string` (the output of `resolveLocalizedSchema`)
   - `BusinessProfile` entity (§5)
2. Create `contexts/onboarding/domain/business-profile-schema.ts` exporting a zod validator that:
   - Accepts `LocalizedString` as either a plain string OR an object with `en` and `pt-br` keys (both required)
   - Rejects JSON where an object-form `LocalizedString` is missing `en` or `pt-br`
   - Validates `supportedLocales` contains only `'en' | 'pt-br'`
   - Enforces that every field `id` in the schema is unique across steps (the registry calls this)
   - Enforces that every `visibleWhen.fieldId` references a real field in the schema
3. Create `contexts/onboarding/infrastructure/business-profile-schemas/v1.json` — the **complete bilingual schema** with all 5 steps (`company`, `products`, `infrastructure`, `customers`, `extras`), every `label`, `title`, `description`, `help`, and option label expressed as `{ en, 'pt-br' }`. Follow the full field inventory listed in PRD §8 (below the JSON snippet). The `title`, `subtitle`, `submitLabel`, `skipLabel`, and `markdownTemplate.heading` at the top level are also `LocalizedString`. Set `"supportedLocales": ["en", "pt-br"]` and `"defaultLocale": "en"`.
4. Create `contexts/onboarding/infrastructure/business-profile-schemas/registry.ts`:
   - `ACTIVE_VERSION = 'v1'`
   - `loadSchema(version: string): BusinessProfileFormSchema` — imports the matching JSON and validates via zod; runs uniqueness checks
   - `getActiveSchema()` — respects `process.env.BUSINESS_PROFILE_SCHEMA_VERSION`
5. Create `contexts/onboarding/application/resolve-localized-schema.ts`:
   - `resolveLocalizedSchema(schema: BusinessProfileFormSchema, locale: SupportedLocale): BusinessProfileFormSchemaResolved`
   - **Pure function.** Walks the schema and flattens every `LocalizedString`:
     - Plain `string` → returned as-is.
     - Object form → returned as `obj[locale]`, falling back to `obj[schema.defaultLocale]`, then to any available key.
   - Never throws on missing translation keys — logs a dev-only warning (behind `process.env.NODE_ENV === 'development'`).
   - Preserves field ids, option values, and all non-display fields unchanged.
6. Create `contexts/onboarding/application/business-profile-markdown.ts` with:
   - `generateBusinessProfileMarkdown(schema, answers, meta: { submittedAt, companyName?, locale: SupportedLocale }): string`
   - **Resolves the schema to the user's locale first** via `resolveLocalizedSchema`, so headings/labels in the generated Markdown match the locale the user filled the form in.
   - Type-aware formatting per PRD §7
   - Prompt-injection escaping (escape backticks, `<|`, `|>`, `role:`, `system:`, `assistant:` in free text)
   - Omits unanswered optional fields
7. Create `contexts/onboarding/application/business-profile-validator.ts`:
   - `validateAnswers(schema, answers): { valid: boolean; errors: Record<string, string> }`
   - Honors `required`, `minLength`, `maxLength`, `min`, `max`, `visibleWhen` (a hidden field is never required)
   - Works against the **raw (localized) schema** — validation does not care about labels, only field ids and constraints.

## Tests (Vitest, colocated)

- `business-profile-schema.test.ts`:
  - Valid fully-bilingual v1.json parses; plain-string `LocalizedString` values also parse.
  - Malformed inputs reject with useful errors:
    - Object `LocalizedString` missing `pt-br` → rejected.
    - Duplicate field `id` across steps → rejected.
    - `visibleWhen.fieldId` referencing a non-existent field → rejected.
    - Unknown field `type` → rejected.
- `resolve-localized-schema.test.ts` (new):
  - Resolving v1 with `locale='en'` returns EN labels throughout; with `locale='pt-br'` returns PT-BR labels throughout.
  - A `LocalizedString` that is a plain string resolves identically in both locales.
  - Missing-translation fallback: if a synthetic schema has only `en` for one field, resolving for `pt-br` falls back to `en` without throwing.
  - Option `value` fields are never touched; only `label` is resolved.
- `business-profile-markdown.test.ts`:
  - **Two snapshot tests**: same canned answer set against v1 with `locale='en'` → EN Markdown; with `locale='pt-br'` → PT-BR Markdown. Both snapshots must be deterministic (byte-identical across runs).
  - Adversarial answer containing `` ` `` and `system:` → assert escaping.
- `business-profile-validator.test.ts`: required enforcement, length bounds, `visibleWhen` skipping (a hidden required field does not produce an error).
- `registry.test.ts`: env override respected; unknown version throws; v1 loads and has both `en` and `pt-br` in `supportedLocales`.

## Acceptance

- All five test files green (including the new `resolve-localized-schema.test.ts`).
- v1.json is **fully bilingual** — an automated check (in `business-profile-schema.test.ts`) walks every `LocalizedString` in v1 and asserts that every object form has both `en` and `pt-br` keys, and every value is non-empty.
- `pnpm exec biome check apps/dashboard/src/contexts/onboarding` clean.
- `pnpm turbo check-types --filter dashboard` clean.
- No imports from `presentation/`, `api/`, `lib/api/`, or Next.js — pure domain + application.

## File Boundaries

```yaml
files_to_create:
  - apps/dashboard/src/contexts/onboarding/domain/business-profile-types.ts
  - apps/dashboard/src/contexts/onboarding/domain/business-profile-schema.ts
  - apps/dashboard/src/contexts/onboarding/domain/business-profile-schema.test.ts
  - apps/dashboard/src/contexts/onboarding/infrastructure/business-profile-schemas/v1.json
  - apps/dashboard/src/contexts/onboarding/infrastructure/business-profile-schemas/registry.ts
  - apps/dashboard/src/contexts/onboarding/infrastructure/business-profile-schemas/registry.test.ts
  - apps/dashboard/src/contexts/onboarding/application/resolve-localized-schema.ts
  - apps/dashboard/src/contexts/onboarding/application/resolve-localized-schema.test.ts
  - apps/dashboard/src/contexts/onboarding/application/business-profile-markdown.ts
  - apps/dashboard/src/contexts/onboarding/application/business-profile-markdown.test.ts
  - apps/dashboard/src/contexts/onboarding/application/business-profile-validator.ts
  - apps/dashboard/src/contexts/onboarding/application/business-profile-validator.test.ts

files_to_modify: []

files_read_only:
  - apps/dashboard/src/contexts/onboarding/domain/types.ts
  - apps/dashboard/CLAUDE.md
  - docs/tasks/dashboard/feature/2026-04-08_1200-onboarding-business-profile-form/spec.md

shared_contracts:
  - BusinessProfileFormSchema, BusinessProfileFormSchemaResolved, FormStep, FormField, FieldType, LocalizedString, SupportedLocale (from PRD §6.1)
  - resolveLocalizedSchema(schema, locale) — pure helper, consumed by Sprint 3 (renderer) and Sprint 1's own markdown transformer
  - BusinessProfile entity (from PRD §5)
```

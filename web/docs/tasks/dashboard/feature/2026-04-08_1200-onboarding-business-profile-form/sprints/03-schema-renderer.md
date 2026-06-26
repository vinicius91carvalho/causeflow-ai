# Sprint 3 — Schema-Driven Form Renderer & Wizard Shell

**PRD:** `../spec.md`
**Batch:** 2
**Depends on:** Sprint 1 (domain types, v1.json)
**Model:** sonnet

## Objective

Build an in-house JSON-schema-driven form renderer on top of `react-hook-form` + `zod` + shadcn primitives. Render any `BusinessProfileFormSchema` as a multi-step wizard with per-step validation, conditional field visibility, localStorage auto-save, and **bilingual (EN + PT-BR) label resolution** via the `resolveLocalizedSchema` helper from Sprint 1.

## Tasks

1. Create `contexts/onboarding/presentation/components/business-profile/field-renderer.tsx`:
   - Consumes **resolved** fields (`FormField<string>` — i.e. after `LocalizedString` has been flattened). Does not import `LocalizedString` itself; the wizard resolves before rendering.
   - One switch over `FormField.type` → renders the right shadcn component
   - Supports: text, textarea, email, url, number, select, multiselect, radio, checkbox-group, tags
   - Uses `react-hook-form` `Controller` for each field
2. Create `contexts/onboarding/presentation/components/business-profile/tags-input.tsx` — small custom tag input (no external dep) used by the `tags` field type.
3. Create `contexts/onboarding/presentation/components/business-profile/step-renderer.tsx`:
   - Renders a resolved `FormStep` — header (title + description), iterates visible fields via `field-renderer.tsx`
   - Computes field visibility from `visibleWhen` using current form values
4. Create `contexts/onboarding/presentation/components/business-profile/wizard.tsx`:
   - Props: `schema: BusinessProfileFormSchema` (raw, unresolved), `locale: SupportedLocale`, `initialAnswers?`, `onSubmit(answers, locale)`, `onSkip()`
   - **First action on mount: `resolvedSchema = useMemo(() => resolveLocalizedSchema(schema, locale), [schema, locale])`** — all downstream rendering consumes the resolved schema.
   - Maintains step index, per-step validation before "Next"
   - Progress indicator (step N of M)
   - Auto-saves to `localStorage` under `causeflow-business-profile-draft-<version>` on every change. The draft key is **per-version only** (not per-locale) — switching locale mid-wizard does not wipe answers; labels just re-render in the new language.
   - Restores draft on mount if present
   - Calls `onSubmit(answers, locale)` on final submit so the page can forward the locale to the API
5. Create `contexts/onboarding/presentation/hooks/use-business-profile-draft.ts`:
   - `{ draft, saveDraft, clearDraft }` backed by localStorage, SSR-safe
6. Create `contexts/onboarding/application/build-zod-from-schema.ts`:
   - `buildZodSchemaForStep(step: FormStepResolved, allValues): ZodSchema` — dynamic zod builder that honors `visibleWhen` (hidden fields not required)
   - Error messages use the resolved (locale-specific) labels so validation feedback is in the user's language.

## Tests (Vitest + Testing Library)

- `field-renderer.test.tsx`: renders each field type, fires user input, calls `onChange`.
- `step-renderer.test.tsx`: hides fields based on `visibleWhen`.
- `wizard.test.tsx`:
  - next/prev navigation, per-step validation blocks advancement
  - submit calls `onSubmit(answers, locale)` — **locale is forwarded**
  - skip calls `onSkip`
  - draft auto-saves and restores
  - **bilingual render test**: same schema mounted with `locale='en'` shows EN labels; remounting with `locale='pt-br'` shows PT-BR labels; answers persist across the locale switch (draft key is per-version, not per-locale)
- `build-zod-from-schema.test.ts`: required enforcement, length bounds, conditional skipping.

## Acceptance

- All tests green.
- `pnpm exec biome check apps/dashboard/src/contexts/onboarding/presentation` clean.
- `pnpm turbo check-types --filter dashboard` clean.
- Renderer is entirely driven by the schema — no hardcoded field IDs or step titles anywhere in the React code.

## File Boundaries

```yaml
files_to_create:
  - apps/dashboard/src/contexts/onboarding/presentation/components/business-profile/field-renderer.tsx
  - apps/dashboard/src/contexts/onboarding/presentation/components/business-profile/field-renderer.test.tsx
  - apps/dashboard/src/contexts/onboarding/presentation/components/business-profile/tags-input.tsx
  - apps/dashboard/src/contexts/onboarding/presentation/components/business-profile/tags-input.test.tsx
  - apps/dashboard/src/contexts/onboarding/presentation/components/business-profile/step-renderer.tsx
  - apps/dashboard/src/contexts/onboarding/presentation/components/business-profile/step-renderer.test.tsx
  - apps/dashboard/src/contexts/onboarding/presentation/components/business-profile/wizard.tsx
  - apps/dashboard/src/contexts/onboarding/presentation/components/business-profile/wizard.test.tsx
  - apps/dashboard/src/contexts/onboarding/presentation/hooks/use-business-profile-draft.ts
  - apps/dashboard/src/contexts/onboarding/presentation/hooks/use-business-profile-draft.test.ts
  - apps/dashboard/src/contexts/onboarding/application/build-zod-from-schema.ts
  - apps/dashboard/src/contexts/onboarding/application/build-zod-from-schema.test.ts

files_to_modify: []

files_read_only:
  - apps/dashboard/src/contexts/onboarding/domain/business-profile-types.ts
  - apps/dashboard/src/contexts/onboarding/domain/business-profile-schema.ts
  - apps/dashboard/src/contexts/onboarding/infrastructure/business-profile-schemas/v1.json
  - packages/ui/src/components/**

shared_contracts:
  - Imports BusinessProfileFormSchema, FormField, FormStep from Sprint 1 domain types
```

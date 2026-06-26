# Forms

CauseFlow composes forms from four layers: the `@causeflow/ui/primitives` primitives (`Input`, `Label`, `Select`, `Textarea`, `Button`, `Card*`), a shared form runtime in `@causeflow/forms` (`useForm`, Zod schemas), inline validation messages, and context-specific submit handlers. This doc describes the canonical composition.

## Field Anatomy

Every form field uses the same four-part stack: **Label → control → helper/error → (optional) description**. The helper/error node is a `<p role="alert">` so it is announced by screen readers when it appears.

```tsx
<div>
  <Label htmlFor="fullName">Full name</Label>
  <Input
    id="fullName"
    value={form.data.fullName}
    onChange={(e) => form.setField('fullName', e.target.value)}
    className="mt-1"
  />
  {form.errors.fullName && (
    <p role="alert" className="mt-1 text-sm text-destructive">
      {form.errors.fullName}
    </p>
  )}
</div>
```

Source: `apps/website/src/contexts/engagement/presentation/components/sections/get-started-form.tsx:97-110`.

Rules:

- Every `Label` carries an `htmlFor` that matches the control's `id`. For `Select`, `Label` is bare (no `htmlFor`) and `SelectTrigger` gets `aria-label` instead (`get-started-form.tsx:141-147`).
- Error messages are `text-destructive` (semantic color), never raw red. This respects the theme token system.
- Margin-top on the control is `mt-1`; margin-top on the error is `mt-1`. Do NOT inherit spacing from a surrounding `space-y-*` wrapper for this stack — the wrapper handles *inter-field* spacing, not *intra-field*.

## Form Container

Forms on marketing pages are wrapped in `Card` + `CardHeader` + `CardContent` to visually anchor them on a larger page canvas. The `<form>` itself uses `space-y-4` for vertical rhythm between fields.

```tsx
<Card className={cn('w-full', className)}>
  <CardHeader>
    {title && <CardTitle className="text-2xl">{title}</CardTitle>}
    {subtitle && <CardDescription>{subtitle}</CardDescription>}
  </CardHeader>
  <CardContent>
    <form onSubmit={...} className="space-y-4">
      {/* fields */}
      <Button type="submit" className="w-full" disabled={form.status === 'submitting'}>
        {form.status === 'submitting' ? 'Creating account...' : submitLabel || 'Create Free Account'}
      </Button>
    </form>
  </CardContent>
</Card>
```

Source: `get-started-form.tsx:83-168`.

In-product forms (e.g. `BusinessProfileWizard`) are NOT wrapped in a Card — they already sit inside the onboarding shell's centered container.

## Validation: Zod + useForm

The shared `@causeflow/forms` package ships Zod schemas plus a `useForm` hook. Usage pattern:

```tsx
import { getStartedSchema, useForm, type GetStartedFormData } from '@causeflow/forms';

const form = useForm<GetStartedFormData>({
  initialData: { fullName: '', workEmail: '', companyName: '', teamSize: '1-5' },
  schema: getStartedSchema,
  onSubmit: async () => {
    // POST here
    return { success: true, message: '...' };
  },
});
```

`form` exposes:

- `data` — current values
- `errors` — `Record<field, string>` populated from `safeParse` issues
- `status` — `'idle' | 'submitting' | 'success' | 'error'`
- `message` — success/error message from the server
- `setField(name, value)` — controlled change handler
- `submit()` — validates, runs `onSubmit`, sets `status`

`form.submit()` is called from `<form onSubmit={(e) => { e.preventDefault(); form.submit(); }}>`.

## Wizard / Multi-step Forms

`BusinessProfileWizard` (`apps/dashboard/src/contexts/onboarding/presentation/components/business-profile/wizard.tsx`) demonstrates the multi-step composition:

- Schema is fetched from `/api/onboarding/business-profile/schema` at runtime — fields are data-driven, not hard-coded.
- Per-step Zod schemas are generated lazily: `buildZodSchemaForStep(currentStep, answers)` (`wizard.tsx:71`). The generator lives in `apps/dashboard/src/contexts/onboarding/application/build-zod-from-schema.ts`.
- `validateCurrentStep` runs `safeParse` and populates `errors[fieldId]` from the first issue per field (`wizard.tsx:70-86`).
- Per-step navigation: Next validates → advances; Back never validates.
- Draft auto-save: `useEffect(() => saveDraft(schema.version, answers), [answers])` (`wizard.tsx:53-55`). Keyed by schema version, not locale.
- Progress bar: `<div className="h-1.5 w-full rounded-full bg-muted">` with an inner `bg-primary` sized to `((stepIndex + 1) / totalSteps) * 100%` (`wizard.tsx:123-128`).
- Submit button swaps `Loader2` spinner in while `submitting` (`wizard.tsx:167-170`).

## Submit States

| State | UI |
|---|---|
| `idle` | Primary button enabled with static label |
| `submitting` | Button `disabled={true}` + swap label to progress verb ("Creating account...", "Saving...") + optional `Loader2` icon with `animate-spin` |
| `success` | Replace form with confirmation Card (`get-started-form.tsx:60-81`) OR toast + route away (`business-profile-page.tsx:84-88`) |
| `error` | Inline `<p role="alert" className="text-sm text-destructive">` above or below the submit button |

## Inline vs Stacked Layouts

- **Stacked (default):** single column, `space-y-4`. Use for most forms — clearer focus order, easier for mobile.
- **Inline (rare):** two-column `grid grid-cols-2 gap-3` wrapping only related fields (e.g. First name / Last name). CauseFlow currently uses an inline grid only for the OAuth button row at `get-started-form.tsx:179` — `grid grid-cols-2 gap-3` wrapping Google / GitHub buttons.

Never mix inline and stacked inside the same logical group — pick one.

## Field Groups

When multiple fields share a concept (e.g. a date range, or `teamSize` + `teamSizeNotes`), wrap them in a `<fieldset>` with a `<legend>` for accessibility. Current code does not ship a fieldset example on the marketing side — when adding one, reuse the `Label` primitive for the legend's visual style and keep the stacked rhythm.

## Tags Input

For free-form multi-value entry, use `TagsInput` (`apps/dashboard/src/contexts/onboarding/presentation/components/business-profile/tags-input.tsx`) which the business-profile wizard renders for `type: 'tags'` schema fields.

## Examples Catalog

| Form | Location | Pattern |
|---|---|---|
| Get Started | `apps/website/src/contexts/engagement/presentation/components/sections/get-started-form.tsx` | Card-wrapped, Zod + `useForm`, OAuth divider, success swap |
| Business profile wizard | `apps/dashboard/src/contexts/onboarding/presentation/components/business-profile/wizard.tsx` | Multi-step, schema-driven, draft auto-save, per-step Zod |
| Notify form fields | `apps/website/src/contexts/engagement/presentation/components/notify-form-fields.tsx` | Field partial reused across the contact + beta-access modals |
| Contact modal | `apps/website/src/contexts/engagement/presentation/components/contact-modal.tsx` | Dialog-wrapped form |
| Beta access modal | `apps/website/src/contexts/engagement/presentation/components/beta-access-modal.tsx` | Dialog-wrapped form with beta-gate check |

## Drift to Watch

- The onboarding wizard's Next/Back use `<Button>` primitive, but most custom dashboard forms still render hand-rolled `<button>` elements with ad-hoc Tailwind. Future cleanup: migrate all submit buttons to `@causeflow/ui` `Button` so disabled + focus-ring styles stay consistent.
- `useForm` is only used by `apps/website` today. Dashboard forms manage `useState` locally. Consider promoting `useForm` into dashboard usage so the validation + submit-state machine is uniform.

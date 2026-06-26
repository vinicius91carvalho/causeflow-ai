# @causeflow/forms

Form validation, state management, sanitization, and submission for CauseFlow AI. Used by `apps/website` contact and sign-up forms.

## Zod Schemas

All form shapes are defined as Zod schemas and exported for use in both client validation and server-side API route validation.

### `contactSchema`

Used by the Contact / Support form.

| Field | Type | Validation |
|---|---|---|
| `name` | `string` | 2–100 characters |
| `email` | `string` | Valid email format |
| `message` | `string` | 10–2000 characters |

### `getStartedSchema`

Used by the Get Started / Sign-Up form.

| Field | Type | Validation |
|---|---|---|
| `fullName` | `string` | 2–100 characters |
| `workEmail` | `string` | Valid email format |
| `companyName` | `string` | 1–200 characters |
| `teamSize` | `string` | One of: `'1-5'`, `'6-20'`, `'21-50'`, `'51-200'`, `'201+'` |

### `notifySchema`

Used by the "Notify me" / waitlist form.

| Field | Type | Validation |
|---|---|---|
| `email` | `string` | Valid email format |

## useForm<T>() Hook

Generic form state manager. Accepts the form's data shape as a type parameter.

```typescript
import { useForm } from '@causeflow/forms'
import { contactSchema } from '@causeflow/forms/schemas'

function ContactForm() {
  const { state, updateField, handleSubmit, reset } = useForm({
    schema: contactSchema,
    onSubmit: async (data) => {
      // Form data is submitted to /api/notify endpoint which handles Loops.so integration
      await fetch('/api/notify', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
  })

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={state.data.name ?? ''}
        onChange={(e) => updateField('name', e.target.value)}
      />
      {state.errors?.name && <p>{state.errors.name}</p>}
      <button disabled={state.status === 'submitting'}>
        {state.status === 'submitting' ? 'Sending...' : 'Send'}
      </button>
      {state.status === 'success' && <p>{state.message}</p>}
    </form>
  )
}
```

### Hook API

| Property | Type | Description |
|---|---|---|
| `state` | `FormState<T>` | Current form state (see below) |
| `updateField` | `(key: keyof T, value: string) => void` | Updates a single field value |
| `handleSubmit` | `(e: FormEvent) => Promise<void>` | Form submit handler — validates, sanitizes, submits |
| `reset` | `() => void` | Resets state to initial idle state |

## FormState<T>

```typescript
type FormState<T> = {
  data: Partial<T>                     // Current field values
  status: 'idle' | 'submitting' | 'success' | 'error'
  errors: Partial<Record<keyof T, string>> | null  // Per-field validation errors
  message: string | null               // Success or error message for display
}
```

Status transitions:

```
idle → submitting → success
                 → error → idle (user edits) → submitting
```

## Sanitization

XSS prevention runs before Zod validation. All string fields are sanitized automatically by `handleSubmit`.

### sanitizeInput(value: string): string

Strips HTML tags and encodes dangerous characters:

```typescript
sanitizeInput('<script>alert("xss")</script>Hello')
// → 'Hello'

sanitizeInput('Normal text with <b>bold</b>')
// → 'Normal text with bold'
```

### sanitizeFormData<T>(data: Partial<T>): Partial<T>

Applies `sanitizeInput` to every string value in the form data object. Non-string fields (numbers, booleans) are passed through unchanged.

The sanitization + validation order is:

1. User submits form
2. `sanitizeFormData` strips any HTML from all string fields
3. Sanitized data is passed to Zod schema `.safeParse()`
4. If validation fails: populate `errors`, set status to `'error'`
5. If validation passes: call `onSubmit` with clean, validated data

## Loops.so Integration

The `/api/notify` endpoint in `apps/website` integrates with Loops.so for form submission handling. Validated form data is sent to Loops.so's API for email campaign management and contact list updates.

The Loops.so API key is read from `LOOPS_API_KEY` (set in `apps/website/.env.local`) and used server-side in the API route handler.

## Security

- **Sanitization before validation:** HTML tags stripped before data reaches Zod schemas, preventing injection via valid-looking inputs
- **Server-side re-validation:** API routes validate all inputs before submission to Loops.so. Never trust client-side validation alone
- **Never render sanitized values as raw HTML** — always render as text content via React's default escaping
- **API key protection:** Loops.so API key stored server-side in `.env.local`, never exposed client-side
- **Rate limiting:** Handled by rate limiter middleware on `/api/notify` (5 requests per minute per IP)

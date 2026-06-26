import { type NextRequest, NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';

type ParseBodyResult<T> = { data: T; error: null } | { data: null; error: NextResponse };

/**
 * Parses and validates the JSON body of a NextRequest against a Zod schema.
 *
 * Returns `{ data, error: null }` on success.
 * Returns `{ data: null, error: NextResponse }` on JSON parse failure or validation failure,
 * with a 400 status response ready to be returned from the handler.
 */
export async function parseBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
): Promise<ParseBodyResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      data: null,
      error: NextResponse.json({ error: 'Invalid request body' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      data: null,
      error: NextResponse.json(
        { error: firstIssue?.message ?? 'Invalid input', issues: parsed.error.issues },
        { status: 400 },
      ),
    };
  }

  return { data: parsed.data, error: null };
}

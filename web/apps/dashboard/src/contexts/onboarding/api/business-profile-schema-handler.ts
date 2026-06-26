/**
 * GET /api/onboarding/business-profile/schema
 *
 * Returns the active business profile form schema (both locales inline).
 * The client resolves LocalizedString fields at render time.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { getActiveSchema } from '@/contexts/onboarding/infrastructure/business-profile-schemas/registry';
import { withAuth } from '@/lib/api/with-auth';

export const GET = withAuth(async (_request: NextRequest, _ctx) => {
  try {
    const schema = getActiveSchema();
    return NextResponse.json({ schema });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to load schema: ${msg}` }, { status: 500 });
  }
});

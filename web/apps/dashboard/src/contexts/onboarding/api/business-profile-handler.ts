/**
 * GET /api/onboarding/business-profile
 * POST /api/onboarding/business-profile
 *
 * Business profile data is persisted exclusively via the Core API's
 * /memory/chat endpoint. The dashboard owns no local storage for this feature.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateBusinessProfileMarkdown } from '@/contexts/onboarding/application/business-profile-markdown';
import type { BusinessProfile } from '@/contexts/onboarding/domain/business-profile-types';
import { getActiveSchema } from '@/contexts/onboarding/infrastructure/business-profile-schemas/registry';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

const MAX_PAYLOAD_BYTES = 20_000; // 20KB

const submitBodySchema = z.object({
  schemaVersion: z.string().min(1),
  answers: z.record(z.unknown()),
  locale: z.enum(['en', 'pt-br']).optional(),
});

/**
 * GET — no read endpoint exists for Core API memory; always return null.
 * The form always starts fresh; edit mode pre-fill is unsupported until
 * a dedicated read endpoint ships on the Core API.
 */
export const GET = withAuth(async (_request: NextRequest, _ctx) => {
  return NextResponse.json({ profile: null });
});

export const POST = withAuth(
  async (request: NextRequest, ctx) => {
    // Enforce max payload size
    const rawText = await request.text();
    if (rawText.length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: 'Payload too large. Maximum submission size is 20KB.' },
        { status: 400 },
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const parsed = submitBodySchema.safeParse(raw);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? 'Invalid input', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { schemaVersion, answers, locale } = parsed.data;

    const schema = getActiveSchema();
    const resolvedLocale = locale ?? schema.defaultLocale;
    const submittedAt = new Date().toISOString();
    const markdown = generateBusinessProfileMarkdown(schema, answers, {
      submittedAt,
      locale: resolvedLocale,
    });

    // Persist to Core API memory — the sole storage for business profile data
    let hindsightStatus: 'sent' | 'failed' = 'sent';
    try {
      const api = getApiClient();
      await api.seedMemoryContext({ source: 'business-profile', schemaVersion, markdown });
    } catch {
      hindsightStatus = 'failed';
    }

    const profile: BusinessProfile = {
      tenantId: ctx.tenantId,
      schemaVersion,
      locale: resolvedLocale,
      answers,
      markdown,
      submittedAt,
      skippedAt: null,
      submittedBy: ctx.userId,
      hindsightStatus,
      hindsightSentAt: hindsightStatus === 'sent' ? submittedAt : null,
      hindsightError: null,
    };

    return NextResponse.json({ profile, markdown });
  },
  { rateLimit: { limit: 5, windowMs: 60 * 1000 } },
);

import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { teamSizeValues } from '@/contexts/identity/domain/types';
import { parseBody } from '@/lib/api/parse-body';
import { getSessionFromRequest } from '@/lib/auth/session-auth';
import { logger as dashLogger } from '@/lib/logger';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

export type { TeamSize } from '@/contexts/identity/domain/types';

const completeProfileSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  companyWebsite: z
    .string()
    .url('Please enter a valid URL')
    .max(255, 'Website URL must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  teamSize: z
    .enum(teamSizeValues, {
      errorMap: () => ({ message: 'Please select a valid team size' }),
    })
    .optional(),
  role: z.string().max(100, 'Role must be 100 characters or less').optional().or(z.literal('')),
});

export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;

export interface CompleteProfileResponse {
  success: true;
  tenantId: string;
  companyName: string;
}

/**
 * POST /api/onboarding/complete-profile
 *
 * Creates a Tenant via the Core API and records terms acceptance.
 * In the OSS build, tenant creation is handled by the Core API directly —
 * no Clerk API calls are made.
 *
 * Flow:
 * 1. Validate session (user must be authenticated)
 * 2. Validate request body with Zod
 * 3. Create Tenant via Core API
 * 4. Record terms acceptance via Core API
 */
export async function POST(request: NextRequest) {
  // Rate limiting: 10 attempts per IP per 15 minutes
  const ip = getClientIp(request);
  const limit = rateLimit(`onboarding-profile:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429 },
    );
  }

  // Authentication check from session cookie
  const claims = await getSessionFromRequest(request);
  const userId = claims?.sub ?? (claims?.userId as string | undefined);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { error: parseError } = await parseBody(request, completeProfileSchema);
  if (parseError) return parseError;

  // In the OSS build, tenant provisioning is handled by the Core API.
  // The Core API creates the tenant + billing account during registration.
  // This handler just needs to confirm the user exists and has a tenant.
  const tenantId = (claims?.tenantId ?? claims?.orgId) as string | undefined;

  if (tenantId) {
    // User already has a tenant — nothing to provision.
    return NextResponse.json(
      {
        success: true,
        tenantId,
        companyName: claims?.name ?? 'My Company',
      } satisfies CompleteProfileResponse,
      { status: 200 },
    );
  }

  // No tenant yet — try to provision one via Core API
  try {
    const coreUrl = process.env.CORE_API_URL;
    if (!coreUrl) {
      // Mock mode — return success with a placeholder tenantId
      return NextResponse.json(
        {
          success: true,
          tenantId: 'mock-tenant',
          companyName: 'My Company',
        } satisfies CompleteProfileResponse,
        { status: 200 },
      );
    }

    const sessionCookie = request.cookies.get('__session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const res = await fetch(`${coreUrl}/v1/tenants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionCookie}`,
      },
      body: JSON.stringify({
        name: 'My Company',
        ownerEmail: claims?.email ?? '',
      }),
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { message?: string };
      return NextResponse.json(
        { error: errBody.message ?? 'Failed to create tenant' },
        { status: res.status },
      );
    }

    const tenant = (await res.json()) as { tenantId?: string; id?: string };
    const resolvedTenantId = tenant.tenantId ?? tenant.id ?? '';

    return NextResponse.json(
      {
        success: true,
        tenantId: resolvedTenantId,
        companyName: 'My Company',
      } satisfies CompleteProfileResponse,
      { status: 200 },
    );
  } catch (err) {
    dashLogger.error(
      { err, method: request.method, path: new URL(request.url).pathname, userId },
      '[complete-profile] Tenant provisioning failed',
    );
    Sentry.captureException(err);
    return NextResponse.json(
      { error: 'Unable to complete setup. Please try again.' },
      { status: 500 },
    );
  }
}

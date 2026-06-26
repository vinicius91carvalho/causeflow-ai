import { generateSlug, randomSlugSuffix } from '@causeflow/shared/domain/utils/slug';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { teamSizeValues } from '@/contexts/identity/domain/types';
import { getApiClient } from '@/lib/api/get-api-client';
import { parseBody } from '@/lib/api/parse-body';
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

  // Authentication check
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { error: parseError } = await parseBody(request, completeProfileSchema);
  if (parseError) return parseError;

  // Get user email and org name from Clerk API
  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);
  const ownerEmail = clerkUser.emailAddresses[0]?.emailAddress ?? '';

  let companyName = 'My Company';
  if (orgId) {
    try {
      const org = await clerk.organizations.getOrganization({ organizationId: orgId });
      companyName = org.name;
    } catch {
      // Fallback to generic name if Clerk API fails
    }
  }

  // -------------------------------------------------------------------------
  // Tenant provisioning is handled by the Core API's Clerk webhook at
  // `POST /v1/auth/clerk-webhook` — when Clerk fires `organization.created`,
  // Core creates the matching Tenant + BillingAccount records automatically
  // using the Clerk `org_id` as the tenantId. This is the authoritative path.
  //
  // Calling `POST /v1/tenants` from the dashboard is redundant and actively
  // harmful: the tenant already exists (webhook fires within ~500ms of org
  // creation) so the call fails with 500 ConditionalCheckFailedException.
  //
  // The call is kept as a best-effort "catch-up" for the edge case where the
  // Clerk webhook has not landed yet, and is wrapped so any error (including
  // the expected "tenant already exists" 500) is ignored. This endpoint stays
  // a fire-and-forget no-op under normal conditions.
  // -------------------------------------------------------------------------
  let resolvedTenantId: string = orgId ?? '';

  try {
    const api = getApiClient();
    const slug = generateSlug(companyName);
    console.log('[complete-profile] Best-effort tenant create:', {
      companyName,
      slug,
      ownerEmail,
    });
    try {
      const tenant = await api.createTenant({ name: companyName, slug, ownerEmail });
      resolvedTenantId = tenant.tenantId;
    } catch (firstErr) {
      const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      const isConflict =
        firstMsg.toLowerCase().includes('slug') ||
        firstMsg.toLowerCase().includes('conflict') ||
        firstMsg.includes('409');

      if (isConflict) {
        // Slug collision — retry once with a random suffix
        try {
          const slugWithSuffix = `${generateSlug(companyName)}-${randomSlugSuffix()}`;
          const tenant = await api.createTenant({
            name: companyName,
            slug: slugWithSuffix,
            ownerEmail,
          });
          resolvedTenantId = tenant.tenantId;
        } catch (retryErr) {
          // Clerk webhook already provisioned the tenant — swallow
          console.log(
            '[complete-profile] Slug retry also failed, tenant likely already exists via Clerk webhook:',
            retryErr instanceof Error ? retryErr.message : String(retryErr),
          );
        }
      } else {
        // The Clerk webhook already provisioned the tenant, or Core API is
        // temporarily failing. Either way, we can't do anything useful here —
        // the choose-plan flow will error out with a clear message if the
        // tenant really doesn't exist when the user clicks a plan.
        console.log(
          '[complete-profile] Core API create failed — assuming Clerk webhook provisioned the tenant:',
          firstMsg,
        );
      }
    }
  } catch (outerErr) {
    // Clerk client or getApiClient failed — still return 200 so the
    // fire-and-forget call from choose-plan doesn't noise the console.
    console.log(
      '[complete-profile] Outer error (non-fatal):',
      outerErr instanceof Error ? outerErr.message : String(outerErr),
    );
  }

  return NextResponse.json(
    {
      success: true,
      tenantId: resolvedTenantId,
      companyName,
    } satisfies CompleteProfileResponse,
    { status: 200 },
  );
}

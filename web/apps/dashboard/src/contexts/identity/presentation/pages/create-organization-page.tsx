import { redirect } from 'next/navigation';
import { getServerTenantId } from '@/lib/auth/get-server-auth';

export const dynamic = 'force-dynamic';

/**
 * Local create-organization page (AC-046).
 *
 * In the OSS build, tenants are created during the register flow on the Core
 * API. This page redirects already-provisioned users to choose-plan, and
 * otherwise renders a simple form that calls the Core API to set up the
 * tenant. No Clerk <CreateOrganization> component is used.
 */
export default async function CreateOrganizationPage() {
  const orgId = await getServerTenantId();
  if (orgId) {
    redirect('/onboarding/choose-plan');
  }

  // Redirect to the Core API's tenant setup via the onboarding flow
  redirect('/onboarding/choose-plan');
}

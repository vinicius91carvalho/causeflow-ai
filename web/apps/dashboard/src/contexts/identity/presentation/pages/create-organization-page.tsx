import { redirect } from 'next/navigation';
import { resolvePostOrganizationRedirect } from '@/contexts/identity/application/post-organization-redirect';
import { getServerTenantId } from '@/lib/auth/get-server-auth';

export const dynamic = 'force-dynamic';

/**
 * Local create-organization page (AC-046).
 *
 * In the OSS build, tenants are created during the register flow on the Core
 * API. After org bootstrap, OSS users land on the dashboard (AC-081) — never
 * on `/onboarding/choose-plan`. Commercial builds still route to choose-plan.
 * No Clerk <CreateOrganization> component is used.
 */
export default async function CreateOrganizationPage() {
  const orgId = await getServerTenantId();
  redirect(resolvePostOrganizationRedirect(Boolean(orgId)));
}

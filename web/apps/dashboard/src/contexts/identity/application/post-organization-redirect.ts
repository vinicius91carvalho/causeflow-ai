import { isOssRuntime } from '@/contexts/billing/application/oss-runtime';

/**
 * Where to send a user immediately after create-organization (or equivalent
 * first-org bootstrap). OSS skips commercial plan selection (AC-081).
 */
export function resolvePostOrganizationRedirect(_hasOrg: boolean): string {
  if (isOssRuntime()) {
    return '/dashboard';
  }
  return '/onboarding/choose-plan';
}

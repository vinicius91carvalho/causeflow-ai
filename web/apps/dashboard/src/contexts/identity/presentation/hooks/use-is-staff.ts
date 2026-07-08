'use client';

import { useUser } from '@/contexts/shared/presentation/components/auth-context';

const STAFF_EMAIL_DOMAINS = ['@causeflow.ai', '@simuser.ai'] as const;

/**
 * Pure check — extracted from the hook so it can be unit-tested without
 * mocking external auth. Case-insensitive. Rejects lookalike domains like
 * `attacker@causeflow.ai.evil.com` because the suffix check requires
 * the whole string to end at a staff domain.
 */
export function isStaffEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return STAFF_EMAIL_DOMAINS.some((domain) => lower.endsWith(domain));
}

/**
 * Returns true when the authenticated user's primary email is a
 * CauseFlow staff email (ends with @causeflow.ai). Used to gate
 * internal-only UI (e.g. the investigation-mode selector).
 *
 * In the OSS build, auth data is always loaded synchronously from the
 * server-provided context, so `isLoaded` is always true.
 */
export function useIsStaff(): boolean {
  const { user } = useUser();
  if (!user) return false;
  return isStaffEmail(user.primaryEmailAddress?.emailAddress);
}

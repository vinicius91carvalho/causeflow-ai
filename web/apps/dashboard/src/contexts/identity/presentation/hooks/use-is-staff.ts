'use client';

import { useUser } from '@clerk/nextjs';

const STAFF_EMAIL_DOMAINS = ['@causeflow.ai', '@simuser.ai'] as const;

/**
 * Pure check — extracted from the hook so it can be unit-tested without
 * mocking Clerk. Case-insensitive. Rejects lookalike domains like
 * `attacker@causeflow.ai.evil.com` because the suffix check requires
 * the whole string to end at a staff domain.
 */
export function isStaffEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return STAFF_EMAIL_DOMAINS.some((domain) => lower.endsWith(domain));
}

/**
 * Returns true when the authenticated Clerk user's primary email is a
 * CauseFlow staff email (ends with @causeflow.ai). Used to gate
 * internal-only UI (e.g. the investigation-mode selector).
 *
 * Returns false while Clerk is loading — callers should treat the
 * loading state as "definitely not staff yet" to avoid flashing
 * staff-only UI to tenant admins.
 */
export function useIsStaff(): boolean {
  const { isLoaded, user } = useUser();
  if (!isLoaded || !user) return false;
  return isStaffEmail(user.primaryEmailAddress?.emailAddress);
}

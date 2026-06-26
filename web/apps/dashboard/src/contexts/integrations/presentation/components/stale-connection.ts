const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Returns true if the date is more than 7 days in the past.
 */
export function isStaleConnection(lastTestedAt: string | undefined): boolean {
  if (!lastTestedAt) return false;
  const date = new Date(lastTestedAt);
  const now = new Date();
  return now.getTime() - date.getTime() > SEVEN_DAYS_MS;
}

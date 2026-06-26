/**
 * Formats an ISO date string into a human-readable date/time string.
 *
 * Uses toLocaleDateString with month (short), day (numeric), year (numeric),
 * hour (2-digit), and minute (2-digit). Falls back to the original string on error.
 */
export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Returns a human-readable relative time string from an ISO date or Date object.
 *
 * @param date    - ISO string or Date to format
 * @param options - `compact: true` uses short units (e.g. "5m ago"), default uses long form (e.g. "5 minutes ago")
 *
 * Examples (compact=false): "just now", "5 minutes ago", "3 hours ago", "2 days ago"
 * Examples (compact=true):  "just now", "5m ago", "3h ago", "2d ago"
 */
export function formatRelativeTime(date: Date | string, options?: { compact?: boolean }): string {
  try {
    const diffMs = Date.now() - new Date(date).getTime();
    const seconds = Math.floor(diffMs / 1000);

    if (options?.compact) {
      if (seconds < 60) return 'just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }

    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days === 1 ? '' : 's'} ago`;
    if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    if (minutes > 0) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    return 'just now';
  } catch {
    return String(date);
  }
}

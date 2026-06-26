/**
 * Shared HTTP response header constants for API routes.
 */

/**
 * Headers to prevent caching of API responses.
 * Use for endpoints that return live data (health checks, topology, notifications).
 */
export const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
} as const;

/**
 * Get the client IP from a Request object.
 *
 * Checks `x-forwarded-for` (first entry) then `x-real-ip` headers.
 * Returns `'unknown'` if neither header is present.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

/**
 * Generates a short, unique, human-readable ID with a given prefix.
 * Format: `<prefix>-<timestamp36>-<random6>`
 * Example: `tenant-lq3x7k-a4b2c9`
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

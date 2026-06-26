/**
 * Generates a URL-safe slug from a given name.
 *
 * Rules:
 * - Lowercase the entire string
 * - Replace any sequence of non-alphanumeric characters (spaces, special chars,
 *   punctuation) with a single hyphen
 * - Remove leading and trailing hyphens
 * - If the result is empty, fall back to "tenant"
 *
 * Examples:
 *   "Acme Corp"        → "acme-corp"
 *   "Café & Boulangerie" → "caf-boulangerie"
 *   "  --MyCompany--"  → "mycompany"
 *   "123 Startup"      → "123-startup"
 */
export function generateSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'tenant';
}

/**
 * Generates a random 4-character alphanumeric suffix for slug deduplication.
 */
export function randomSlugSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

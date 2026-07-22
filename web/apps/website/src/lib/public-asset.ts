/**
 * Prefix a root-absolute public asset path with the GitHub Pages base path
 * when building/serving under /causeflow-ai.
 */
export function publicAsset(path: string): string {
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('data:') ||
    path.startsWith('blob:')
  ) {
    return path;
  }

  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (!base) return path;
  if (path.startsWith(base)) return path;
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

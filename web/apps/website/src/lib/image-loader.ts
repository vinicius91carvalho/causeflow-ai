/**
 * Custom next/image loader for GitHub Pages static export.
 * With `images.unoptimized`, Next does not always prefix `basePath` onto
 * public asset paths like `/icons/...`, so we apply NEXT_PUBLIC_BASE_PATH here.
 */
export default function imageLoader({ src }: { src: string }): string {
  if (
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('data:') ||
    src.startsWith('blob:')
  ) {
    return src;
  }

  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (!base) return src;

  if (src.startsWith(base)) return src;
  return src.startsWith('/') ? `${base}${src}` : `${base}/${src}`;
}

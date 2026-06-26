declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

/**
 * Injects the Microsoft Clarity tracking script into the document head.
 * Clarity handles heatmaps, session recordings, and behavioral analytics
 * automatically once initialized — no custom event calls needed.
 */
export function initClarity(clarityId: string): void {
  if (typeof window === 'undefined') return;

  // Prevent duplicate initialization
  if (window.clarity) return;

  if (!clarityId) return;

  window.clarity =
    window.clarity ||
    function clarity(...args: unknown[]) {
      (window.clarity as unknown as { q: unknown[] }).q =
        (window.clarity as unknown as { q: unknown[] }).q || [];
      (window.clarity as unknown as { q: unknown[] }).q.push(args);
    };

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${clarityId}`;
  document.head.appendChild(script);
}

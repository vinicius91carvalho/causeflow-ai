import type { AnalyticsEvent } from '../../domain/types/events';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/**
 * Injects the Google Analytics 4 gtag.js script into the document head
 * and initializes the dataLayer with the provided measurement ID.
 */
export function initGA4(measurementId: string): void {
  if (typeof window === 'undefined') return;

  // Prevent duplicate initialization
  if (document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${measurementId}"]`)) {
    return;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };

  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    send_page_view: false,
  });
}

/**
 * Sends a typed analytics event to GA4 via the gtag API.
 */
export function trackGA4Event(event: AnalyticsEvent): void {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', event.name, event.properties);
}

/**
 * Sends a page_view event to GA4 with the given path and locale.
 */
export function trackGA4PageView(path: string, locale: string): void {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    language: locale,
  });
}

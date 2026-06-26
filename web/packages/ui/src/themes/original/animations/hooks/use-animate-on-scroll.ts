'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface UseAnimateOnScrollOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

// Use useLayoutEffect in browser, useEffect in SSR to avoid warnings
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useAnimateOnScroll<T extends HTMLElement = HTMLDivElement>(
  options: UseAnimateOnScrollOptions = {},
) {
  const { threshold = 0.1, rootMargin = '0px', triggerOnce = true } = options;
  const ref = useRef<T>(null);

  // isMounted: false on SSR and first client render; true after hydration.
  // Consumers render content as visible when !isMounted so SSR HTML never
  // ships hidden (fixes blank-below-the-fold screenshots + no-JS/slow-JS
  // users + SEO crawlers that don't run animation effects).
  const [isMounted, setIsMounted] = useState(false);

  // alreadyVisible: true when the element was in the viewport on initial mount.
  // When true, we skip both the hidden initial class AND the transition, so
  // Lighthouse sees the full content on the first paint (fixing Speed Index).
  const [alreadyVisible, setAlreadyVisible] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // prefersReducedMotion: true when the OS/browser accessibility setting requests
  // reduced motion. When true, we skip all scroll-triggered animation entirely —
  // every element is immediately visible without transitions. This also ensures
  // Playwright tests running with --force-prefers-reduced-motion see full content.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useIsomorphicLayoutEffect(() => {
    // Mark hydrated. Consumers use this to gate the hidden-class application
    // so that SSR HTML is always visible and animation is strictly a
    // post-hydration progressive enhancement.
    setIsMounted(true);

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Set initial value synchronously so the first render is correct
    setPrefersReducedMotion(mql.matches);

    // Keep in sync if the user changes the preference at runtime
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // useLayoutEffect runs synchronously after DOM paint but before the browser
  // repaints, so we can check viewport position before any frame is shown.
  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

    // Check if the element is at least partially visible in the viewport
    const isInViewport =
      rect.top < viewportHeight && rect.bottom > 0 && rect.left < viewportWidth && rect.right > 0;

    if (isInViewport) {
      // Mark as already visible — component will render with full opacity,
      // no transition, no animation delay. This is the Speed Index fix.
      setAlreadyVisible(true);
      setIsVisible(true);
    }
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // If already visible from mount (above fold), no need to observe
    if (alreadyVisible && triggerOnce) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce) observer.unobserve(element);
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin, triggerOnce, alreadyVisible]);

  return { ref, isMounted, isVisible, alreadyVisible, prefersReducedMotion };
}

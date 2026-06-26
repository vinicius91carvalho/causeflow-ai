'use client';

import { useEffect, useState } from 'react';

/**
 * SSR-safe hook that returns the current vertical scroll position (`window.scrollY`).
 * Uses a passive event listener for optimal scroll performance.
 * Returns `0` on the server.
 *
 * @returns The current `scrollY` value in pixels
 */
export function useScrollPosition(): number {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    function handleScroll() {
      setScrollY(window.scrollY);
    }

    // Set initial value
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return scrollY;
}

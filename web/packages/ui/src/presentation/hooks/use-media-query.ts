'use client';

import { useEffect, useState } from 'react';

/**
 * SSR-safe hook that evaluates a CSS media query and returns whether it matches.
 * Returns `false` on the server and during hydration to avoid mismatches.
 *
 * @param query - A CSS media query string, e.g. `"(min-width: 768px)"`
 * @returns `true` when the media query matches, `false` otherwise
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);

    // Set the initial value
    setMatches(mediaQueryList.matches);

    function handleChange(event: MediaQueryListEvent) {
      setMatches(event.matches);
    }

    mediaQueryList.addEventListener('change', handleChange);

    return () => {
      mediaQueryList.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}

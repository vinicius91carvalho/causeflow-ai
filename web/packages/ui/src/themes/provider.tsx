'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ColorMode, ThemeId } from './types';

interface ThemeContextValue {
  themeId: ThemeId;
  colorMode: ColorMode;
  resolvedColorMode: 'light' | 'dark';
  setThemeId: (id: ThemeId) => void;
  setColorMode: (mode: ColorMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultThemeId?: ThemeId;
  defaultColorMode?: ColorMode;
  storageKey?: string;
  /**
   * When true, force `defaultColorMode` on every mount and ignore any persisted
   * value from localStorage. Used to lock a surface to a single mode (e.g. the
   * marketing site is light-only) without letting stale visitor state override
   * the product decision.
   */
  lockColorMode?: boolean;
  /**
   * Optional callback invoked after localStorage is updated with a new color mode.
   * Useful for persisting the preference to a remote API without coupling this
   * package to any API client. Fire-and-forget: errors must not propagate.
   */
  onThemeChange?: (theme: ColorMode) => void | Promise<void>;
}

export function ThemeProvider({
  children,
  defaultThemeId = 'original',
  defaultColorMode = 'system',
  storageKey = 'causeflow-theme',
  lockColorMode = false,
  onThemeChange,
}: ThemeProviderProps) {
  // Lazy initializer reads localStorage synchronously on first mount, so the
  // DOM-apply effect below sees the persisted value on its first run instead
  // of clobbering it with the server-injected default (race that flipped
  // light → dark after locale changes).
  const readStored = (): { themeId?: ThemeId; colorMode?: ColorMode } => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = window.localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  };

  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const stored = readStored();
    return stored.themeId ?? defaultThemeId;
  });
  const [colorMode, setColorMode] = useState<ColorMode>(() => {
    if (lockColorMode) return defaultColorMode;
    const stored = readStored();
    return stored.colorMode ?? defaultColorMode;
  });
  // Initialize resolvedColorMode from the effective initial colorMode so SSR/first
  // render matches the intended state. 'system' resolves to 'dark' as a safe
  // server-side default (the client-side effect below re-resolves against the
  // media query on mount).
  const [resolvedColorMode, setResolvedColorMode] = useState<'light' | 'dark'>(() => {
    const initial = lockColorMode ? defaultColorMode : (readStored().colorMode ?? defaultColorMode);
    return initial === 'light' ? 'light' : 'dark';
  });

  // Guard: skip onThemeChange on the initial mount — only fire on subsequent
  // user-triggered changes (setThemeId / setColorMode).
  const isFirstRenderRef = useRef(true);

  const resolveColorMode = useCallback((mode: ColorMode): 'light' | 'dark' => {
    if (mode === 'system') {
      return typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return mode;
  }, []);

  useEffect(() => {
    const resolved = resolveColorMode(colorMode);
    setResolvedColorMode(resolved);

    const root = document.documentElement;
    root.setAttribute('data-theme', themeId);
    root.classList.toggle('dark', resolved === 'dark');

    localStorage.setItem(storageKey, JSON.stringify({ themeId, colorMode }));

    // Fire-and-forget persistence callback. Errors must not propagate to the
    // provider — the UI has already updated optimistically via localStorage.
    // Skip on the initial mount: the effect runs once to sync DOM state from
    // defaults/localStorage, which is not a user-triggered change.
    if (onThemeChange) {
      if (isFirstRenderRef.current) {
        isFirstRenderRef.current = false;
      } else {
        Promise.resolve()
          .then(() => onThemeChange(colorMode))
          .catch((err) => {
            console.warn('[theme] persistence failed', err);
          });
      }
    }
  }, [themeId, colorMode, resolveColorMode, storageKey, onThemeChange]);

  useEffect(() => {
    if (colorMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setResolvedColorMode(e.matches ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [colorMode]);

  return (
    <ThemeContext
      value={{
        themeId,
        colorMode,
        resolvedColorMode,
        setThemeId,
        setColorMode,
      }}
    >
      {children}
    </ThemeContext>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

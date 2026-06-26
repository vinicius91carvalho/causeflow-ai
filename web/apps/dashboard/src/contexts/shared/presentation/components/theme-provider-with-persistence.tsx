'use client';

import { ThemeProvider } from '@causeflow/ui/themes/provider';
import type { ColorMode, ThemeId } from '@causeflow/ui/themes/types';

/**
 * Thin client wrapper around ThemeProvider that adds API persistence.
 *
 * Wires `onThemeChange` to PATCH /api/settings so theme choices are saved
 * server-side without coupling packages/ui to the dashboard API client.
 *
 * Design decisions:
 * - Fire-and-forget: the UI applies the theme optimistically via localStorage
 *   first (inside ThemeProvider), then this callback persists to the API.
 * - Errors are logged to console only — the UI must not revert on API failure.
 * - No import of getApiClient() here: this is a client component that calls
 *   the dashboard's own /api/settings route (auth handled by Clerk session cookie).
 */
async function persistTheme(theme: ColorMode): Promise<void> {
  const res = await fetch('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme }),
  });
  if (!res.ok) {
    throw new Error(`PATCH /api/settings responded ${res.status}`);
  }
}

interface ThemeProviderWithPersistenceProps {
  children: React.ReactNode;
  defaultThemeId?: ThemeId;
  defaultColorMode?: ColorMode;
}

export function ThemeProviderWithPersistence({
  children,
  defaultThemeId,
  defaultColorMode,
}: ThemeProviderWithPersistenceProps) {
  return (
    <ThemeProvider
      defaultThemeId={defaultThemeId}
      defaultColorMode={defaultColorMode}
      onThemeChange={persistTheme}
    >
      {children}
    </ThemeProvider>
  );
}

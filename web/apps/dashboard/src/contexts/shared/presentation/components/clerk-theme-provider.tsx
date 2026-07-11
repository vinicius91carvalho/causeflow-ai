'use client';

/**
 * Open-source local-runtime theme provider.
 *
 * Previously wrapped the app in Clerk's `<ClerkProvider>` for hosted auth UI
 * theming. With Clerk removed (AC-046), auth is a local React form and no
 * Clerk provider is needed. This component is now a transparent passthrough so
 * the root layout's import + tree shape stays stable. No third-party auth
 * SDK import remains, so mounting this provider never contacts clerk.com.
 */
export function ClerkThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

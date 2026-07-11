import { AnalyticsProvider } from '@causeflow/analytics';
import { defaultThemeId } from '@causeflow/ui/themes';
import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import {
  AuthProvider,
  type ClientAuthState,
} from '@/contexts/shared/presentation/components/auth-context';
import { ClerkThemeProvider } from '@/contexts/shared/presentation/components/clerk-theme-provider';
import { ThemeProviderWithPersistence } from '@/contexts/shared/presentation/components/theme-provider-with-persistence';
import { routing } from '@/i18n/routing';
import { claimsToAuthContext, SESSION_COOKIE, verifySessionCookie } from '@/lib/auth/session-auth';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
});

const analyticsConfig = {
  ga4MeasurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
  clarityId: process.env.NEXT_PUBLIC_CLARITY_ID,
  enabled: process.env.NODE_ENV === 'production',
};

/**
 * Inline script to prevent FOUC — applies the correct dark/light class before React hydrates.
 *
 * Priority order:
 *   1. cf_theme cookie (written by middleware after syncing from Core API — authoritative)
 *   2. causeflow-theme key in localStorage (legacy client-only fallback)
 *   3. System preference via matchMedia (last resort)
 *
 * Security: cookie value is NEVER string-interpolated into the script body.
 * A whitelist switch over the three known-good enum values ('light'|'dark'|'system')
 * is used to determine the DOM action. Any other cookie value is treated as absent.
 *
 * Safe: this is a static string constant — no user input reaches script source.
 */
const themeInitScript = [
  '(function(){',
  '  try {',
  '    var d = document.documentElement;',
  '    var theme = null;',
  '    // 1. Read cf_theme cookie (authoritative — set by middleware from Core API)',
  "    var cookies = document.cookie.split(';');",
  '    for (var i = 0; i < cookies.length; i++) {',
  "      var parts = cookies[i].trim().split('=');",
  "      if (parts[0] === 'cf_theme' && parts.length > 1) {",
  '        var v = parts[1].trim();',
  "        if (v === 'light' || v === 'dark' || v === 'system') { theme = v; }",
  '        break;',
  '      }',
  '    }',
  '    // 2. Fall back to localStorage',
  '    if (!theme) {',
  "      var s = localStorage.getItem('causeflow-theme');",
  '      if (s) {',
  '        var p = JSON.parse(s);',
  "        if (p.themeId) d.setAttribute('data-theme', p.themeId);",
  "        if (p.colorMode === 'light' || p.colorMode === 'dark' || p.colorMode === 'system') {",
  '          theme = p.colorMode;',
  '        }',
  '      }',
  '    }',
  '    // 3. Apply via whitelist switch — never interpolate raw cookie value',
  "    if (theme === 'light') {",
  "      d.classList.remove('dark');",
  "    } else if (theme === 'dark') {",
  "      d.classList.add('dark');",
  "    } else if (theme === 'system') {",
  "      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {",
  "        d.classList.add('dark');",
  '      } else {',
  "        d.classList.remove('dark');",
  '      }',
  '    } else {',
  '      // No preference found — default to light',
  "      d.classList.remove('dark');",
  '    }',
  '  } catch(e) {}',
  '})();',
].join('\n');

export const viewport: Viewport = {
  themeColor: '#0A0A14',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const isStaging = process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE === 'staging';

export const metadata: Metadata = {
  metadataBase: new URL('https://dashboard.causeflow.ai'),
  title: {
    template: '%s | CauseFlow AI',
    default: 'CauseFlow AI Dashboard',
  },
  description: 'AI-powered incident investigation dashboard for engineering teams.',
  robots: isStaging ? { index: false, follow: false } : undefined,
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Read and verify the __session cookie on the server, returning the
 * auth state for the client-side AuthProvider. Public pages that don't
 * need auth get a null state (default = unauthenticated).
 */
async function getServerAuthState(): Promise<ClientAuthState | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sessionCookie) return null;

    const claims = await verifySessionCookie(sessionCookie);
    if (!claims) return null;

    const auth = claimsToAuthContext(claims);
    const email = auth.email;
    const isStaff = ['@causeflow.ai', '@simuser.ai'].some((d) => email.toLowerCase().endsWith(d));

    return {
      userId: auth.userId || null,
      tenantId: auth.tenantId || null,
      email,
      name: auth.name || null,
      role: auth.role,
      isSignedIn: true,
      isStaff,
    };
  } catch {
    return null;
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const authState = await getServerAuthState();

  // biome-ignore lint/security/noDangerouslySetInnerHtml: static string constant for FOUC prevention, not user input
  const themeScript = <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />;

  return (
    <html
      lang={locale}
      className={`${plusJakartaSans.variable}`}
      data-theme={defaultThemeId}
      suppressHydrationWarning
    >
      <head>{themeScript}</head>
      <body className="bg-background font-sans antialiased">
        <AnalyticsProvider config={analyticsConfig}>
          <NextIntlClientProvider messages={messages}>
            <ThemeProviderWithPersistence defaultThemeId={defaultThemeId} defaultColorMode="light">
              <ClerkThemeProvider>
                <AuthProvider authState={authState}>{children}</AuthProvider>
              </ClerkThemeProvider>
            </ThemeProviderWithPersistence>
          </NextIntlClientProvider>
        </AnalyticsProvider>
      </body>
    </html>
  );
}

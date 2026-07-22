import { AnalyticsProvider } from '@causeflow/analytics';
import { defaultThemeId } from '@causeflow/ui/themes';
import { ThemeProvider } from '@causeflow/ui/themes/provider';
import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import {
  organizationSchema,
  StructuredData,
  websiteSchema,
} from '@/contexts/marketing/presentation/components/structured-data';
import { routing } from '@/i18n/routing';
import '@causeflow/ui/styles';
import 'highlight.js/styles/github.css';
import '@/styles/code-block.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains-mono',
});

const analyticsConfig = {
  ga4MeasurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
  clarityId: process.env.NEXT_PUBLIC_CLARITY_ID,
  enabled: process.env.NODE_ENV === 'production',
};

/** Website is light-only. Force-remove any stale .dark class before paint. */
const themeInitScript = `
(function(){
  try {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('causeflow-theme', JSON.stringify({ themeId: 'original', colorMode: 'light' }));
  } catch(e) {}
})();
`;

const isStaging = process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE === 'staging';
// Static export does not always prefix metadata icon URLs with next.config basePath.
const assetBase = process.env.GITHUB_PAGES === '1' ? '/causeflow-ai' : '';

export const viewport: Viewport = {
  themeColor: '#0A0A14',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://causeflow.ai'),
  title: {
    template: '%s | CauseFlow AI',
    default: "CauseFlow AI — Your Stack's Problem Detective",
  },
  description:
    'AI-powered incident investigation for engineering teams of 2-50 engineers. Root cause analysis in minutes, not hours.',
  icons: {
    icon: [{ url: `${assetBase}/favicon.svg`, type: 'image/svg+xml' }],
    apple: [
      { url: `${assetBase}/apple-touch-icon.png` },
      { url: `${assetBase}/apple-icon.svg`, type: 'image/svg+xml' },
    ],
  },
  openGraph: {
    images: [
      { url: `${assetBase}/og-image.png`, width: 1200, height: 630, alt: 'CauseFlow AI' },
    ],
  },
  ...(isStaging && {
    robots: { index: false, follow: false },
  }),
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
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

  // Only pass namespaces needed by client components to reduce RSC payload.
  // Server components access all messages via getTranslations() directly.
  const allMessages = messages as Record<string, unknown>;
  const clientMessages = {
    common: allMessages.common,
    betaAccess: allMessages.betaAccess,
    deploymentApproaches: allMessages.deploymentApproaches,
    getStarted: allMessages.getStarted,
    home: {
      whyDifferent: (allMessages.home as Record<string, unknown>)?.whyDifferent,
      whyNow: (allMessages.home as Record<string, unknown>)?.whyNow,
      categoryIsReal: (allMessages.home as Record<string, unknown>)?.categoryIsReal,
    },
  };

  return (
    <html
      lang={locale}
      className={`${plusJakartaSans.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      data-theme={defaultThemeId}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <StructuredData data={organizationSchema} />
        <StructuredData data={websiteSchema} />
        <AnalyticsProvider config={analyticsConfig}>
          <NextIntlClientProvider messages={clientMessages}>
            <ThemeProvider defaultThemeId={defaultThemeId} defaultColorMode="light" lockColorMode>
              {children}
            </ThemeProvider>
          </NextIntlClientProvider>
        </AnalyticsProvider>
      </body>
    </html>
  );
}

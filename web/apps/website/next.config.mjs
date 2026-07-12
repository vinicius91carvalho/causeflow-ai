import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV === 'development';

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ??
  (process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE === 'production'
    ? 'https://dashboard.causeflow.ai'
    : 'https://dashboard-staging.causeflow.ai');

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  redirects: async () => [
    // /get-started is retired — route users straight to the dashboard sign-up.
    {
      source: '/get-started',
      destination: `${DASHBOARD_URL}/auth/sign-up`,
      permanent: true,
      locale: false,
    },
    {
      source: '/:locale(pt-br)/get-started',
      destination: `${DASHBOARD_URL}/auth/sign-up`,
      permanent: true,
      locale: false,
    },
  ],
  transpilePackages: [
    '@causeflow/shared',
    '@causeflow/ui',
    '@causeflow/analytics',
    '@causeflow/forms',
  ],
  experimental: {
    optimizePackageImports: [
      '@causeflow/ui',
      '@causeflow/shared',
      '@causeflow/analytics',
      '@causeflow/forms',
      'lucide-react',
      'next-intl',
      '@radix-ui/react-accordion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-label',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
    ],
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://*.clarity.ms`,
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' data: https:",
            "font-src 'self' https://fonts.gstatic.com",
            `connect-src 'self' https://www.google-analytics.com https://*.clarity.ms ${DASHBOARD_URL}${isDev ? ' ws://127.0.0.1:* ws://localhost:*' : ''}`,
            "frame-src 'self'",
            "worker-src 'self' blob:",
          ].join('; '),
        },
      ],
    },
  ],
};

export default withNextIntl(nextConfig);

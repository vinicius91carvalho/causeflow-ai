import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV === 'development';

// Clerk domains for auth UI (scripts, fonts, API)
const clerkDomain =
  'https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com https://clerk.causeflow.ai https://challenges.cloudflare.com https://clerk-telemetry.com';

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'logos.composio.dev' },
      { protocol: 'https', hostname: 'backend.composio.dev' },
    ],
  },
  transpilePackages: [
    '@causeflow/auth',
    '@causeflow/shared',
    '@causeflow/ui',
    '@causeflow/analytics',
    '@causeflow/forms',
    'react-markdown',
  ],
  // Keep the AWS SDK (and its node:crypto dependency) server-side only.
  // auth-config.ts imports cognito-client.ts which uses node:crypto — without
  // this, Webpack would try to bundle it for the client bundle and fail.
  serverExternalPackages: ['@aws-sdk/client-cognito-identity-provider'],
  // onDemandEntries: keep recently-compiled pages in memory so navigation in
  // dev does not re-trigger a full compile. Defaults (25s / 2 pages) are too
  // tight for a dashboard with many routes — bump them so flipping between
  // /dashboard and /dashboard/integrations is near-instant after the first
  // compile.
  onDemandEntries: {
    maxInactiveAge: 10 * 60 * 1000, // 10 minutes (default: 25s)
    pagesBufferLength: 8, // keep last 8 pages in memory (default: 2)
  },
  experimental: {
    // `optimizePackageImports` rewrites top-level imports into per-subpath
    // imports so Webpack only compiles the modules actually used. Every
    // heavy package we pull in should live here — especially Clerk (invoked
    // from middleware on every navigation) and our internal packages, which
    // are otherwise deeply walked by the dev compiler.
    optimizePackageImports: [
      // Icons — imported from dozens of files
      'lucide-react',
      // Internal packages
      '@causeflow/ui',
      '@causeflow/shared',
      '@causeflow/analytics',
      '@causeflow/forms',
      '@causeflow/auth',
      // Clerk — middleware imports clerkMiddleware on every route
      '@clerk/nextjs',
      '@clerk/themes',
      // Stripe React bindings (billing page)
      '@stripe/react-stripe-js',
      // Radix primitives used across the dashboard
      '@radix-ui/react-accordion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
    ],
  },
  headers: async () => [
    // -------------------------------------------------------------------------
    // Security headers applied to all routes
    // -------------------------------------------------------------------------
    {
      source: '/(.*)',
      headers: [
        // Prevent clickjacking — dashboard should never be embedded in iframes
        { key: 'X-Frame-Options', value: 'DENY' },

        // Prevent MIME type sniffing
        { key: 'X-Content-Type-Options', value: 'nosniff' },

        // Send full referrer for same-origin, only origin for cross-origin
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

        // Restrict browser features
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), payment=()',
        },

        // HSTS: 2 years, include subdomains, preload-ready
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },

        // Content Security Policy
        // Dashboard is an authenticated app — stricter than the marketing site.
        // Cognito hosted UI is included in frame-src and connect-src for OAuth flows.
        // Google Fonts is included for Plus Jakarta Sans.
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",

            // Scripts: self + inline (Next.js requires) + analytics (optional)
            // unsafe-eval only in dev (needed by Next.js hot reload)
            `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://*.clarity.ms https://js.stripe.com ${clerkDomain}`,

            // Styles: self + inline (Tailwind/CSS-in-JS) + Google Fonts
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

            // Images: self + data URIs (avatars, icons) + HTTPS (CDN, user avatars)
            "img-src 'self' data: https:",

            // Fonts: self + Google Fonts CDN
            `font-src 'self' https://fonts.gstatic.com ${clerkDomain}`,

            // Connections: self + analytics + AWS Cognito + DynamoDB/API calls
            // DynamoDB is called server-side (Lambda), not client-side — no need here
            [
              "connect-src 'self'",
              'https://www.google-analytics.com',
              'https://*.clarity.ms',
              // Clerk API
              clerkDomain,
              // Stripe Elements (billing page) talks to api.stripe.com + m.stripe.network
              'https://api.stripe.com https://m.stripe.network https://m.stripe.com',
              // Sentry error reporting (must be in connect-src or browser blocks silently)
              'https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io',
              // Investigation relay WebSocket (Core API)
              'wss://api-staging.causeflow.ai wss://api.causeflow.ai',
              isDev ? 'ws://127.0.0.1:* ws://localhost:*' : '',
            ]
              .filter(Boolean)
              .join(' '),

            // Frames: self + Clerk (auth UI) + Stripe Checkout/Elements iframes
            `frame-src 'self' ${clerkDomain} https://js.stripe.com https://hooks.stripe.com`,

            // Workers: self + blob (needed by some libraries)
            "worker-src 'self' blob:",

            // Manifest
            "manifest-src 'self'",
          ].join('; '),
        },

        // Cross-Origin policies — relaxed for Clerk auth + Cloudflare Turnstile
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
      ],
    },

    // -------------------------------------------------------------------------
    // API routes: additional CORS configuration
    // All API routes are protected by Auth.js middleware — only same-origin
    // requests are expected. External API access is not supported.
    // -------------------------------------------------------------------------
    {
      source: '/api/(.*)',
      headers: [
        {
          key: 'Access-Control-Allow-Origin',
          value: isDev ? 'http://127.0.0.1:3001' : 'https://dashboard.causeflow.ai',
        },
        { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        { key: 'Access-Control-Max-Age', value: '86400' },
        // Prevent API responses from being cached by CDN
        { key: 'Cache-Control', value: 'no-store' },
      ],
    },
  ],
  webpack(config, { dev }) {
    // Handle node: URI scheme for transpiled monorepo packages.
    // @causeflow/auth uses `import { createHmac } from 'node:crypto'` in
    // cognito-client.ts. When auth.ts (a server component helper) imports
    // @causeflow/auth/server, Webpack traces through to node:crypto and fails
    // with UnhandledSchemeError because the node: scheme is not a registered
    // Webpack plugin. We add an externals function that resolves node: imports
    // to their unprefixed counterparts (Node.js handles both at runtime).
    const originalExternals = Array.isArray(config.externals)
      ? config.externals
      : config.externals
        ? [config.externals]
        : [];

    config.externals = [
      ...originalExternals,
      ({ request }, callback) => {
        // Rewrite `node:crypto` → external `crypto` (Node.js built-in).
        // Works for both server and edge runtimes — neither bundles Node builtins.
        if (request?.startsWith('node:')) {
          return callback(null, `commonjs ${request.slice(5)}`);
        }
        callback();
      },
    ];

    // Dev-only optimizations — skip expensive work that only matters for
    // production bundling. These shave noticeable time off HMR rebuilds in
    // the PRoot ARM64 environment where Webpack is already slow.
    if (dev) {
      config.optimization = {
        ...config.optimization,
        // Skip module-availability pruning during rebuilds — it's a huge
        // graph walk that Webpack does not need in dev.
        removeAvailableModules: false,
        // Don't bother stripping empty chunks in dev; it costs more than it
        // saves.
        removeEmptyChunks: false,
      };

      // Watch large, noisy directories less aggressively so inotify isn't
      // constantly waking Webpack up.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/.git/**', '**/node_modules/**', '**/.next/**', '**/.artifacts/**'],
        aggregateTimeout: 200,
      };
    }

    return config;
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: { treeshake: { removeDebugLogging: true } },
  hideSourceMaps: true,
});

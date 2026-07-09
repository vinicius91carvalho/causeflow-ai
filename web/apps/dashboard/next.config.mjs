import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isDev = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { hostname: 'logos.composio.dev', protocol: 'https' },
      { hostname: 'backend.composio.dev', protocol: 'https' },
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
        // Open-source local runtime: no Clerk / Stripe / Sentry / Composio
        // outbound endpoints are allow-listed (AC-044/AC-050). Optional GA4 /
        // Microsoft Clarity analytics remain gated on env vars being set.
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",

            // Scripts: self + inline (Next.js requires) + analytics (optional)
            // unsafe-eval only in dev (needed by Next.js hot reload)
            `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://*.clarity.ms`,

            // Styles: self + inline (Tailwind/CSS-in-JS) + Google Fonts
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

            // Images: self + data URIs (avatars, icons) + HTTPS (CDN, user avatars)
            "img-src 'self' data: https:",

            // Fonts: self + Google Fonts CDN
            "font-src 'self' https://fonts.gstatic.com",

            // Connections: self + analytics only (OSS build — no Clerk/Stripe/Sentry)
            [
              "connect-src 'self'",
              'https://www.google-analytics.com',
              'https://*.clarity.ms',
              // Investigation relay WebSocket (Core API)
              'wss://api-staging.causeflow.ai wss://api.causeflow.ai',
              isDev ? 'ws://127.0.0.1:* ws://localhost:*' : '',
            ]
              .filter(Boolean)
              .join(' '),

            // Frames: self only (local auth forms, no Clerk/Stripe iframes)
            "frame-src 'self'",

            // Workers: self + blob (needed by some libraries)
            "worker-src 'self' blob:",

            // Manifest
            "manifest-src 'self'",
          ].join('; '),
        },

        // Cross-Origin policies
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
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

export default withNextIntl(nextConfig);

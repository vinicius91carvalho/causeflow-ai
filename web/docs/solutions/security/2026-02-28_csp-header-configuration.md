---
title: CSP header configuration for Next.js with GA4, Clarity, Cognito, and Google Fonts
date: 2026-02-28
category: security
tags: [csp, content-security-policy, next.js, ga4, clarity, cognito, google-fonts, security-headers]
app: website, dashboard
severity: high
---

# CSP header configuration for Next.js with GA4, Clarity, Cognito, and Google Fonts

## Problem

Next.js applications with third-party scripts (GA4, Microsoft Clarity), external fonts (Google Fonts), and AWS Cognito for authentication need a Content Security Policy that:
- Blocks XSS and data injection attacks
- Allows Next.js's own inline scripts and hot-reload WebSockets in dev
- Permits all required third-party origins without loosening the policy globally

## Solution

CSP is set in `next.config.mjs` via the `headers()` function. Both apps have similar base policies with app-specific additions.

### Website CSP (`apps/website/next.config.mjs`)

```ts
const isDev = process.env.NODE_ENV === 'development';

{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://*.clarity.ms`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' https://www.google-analytics.com https://app.loops.so https://*.clarity.ms${isDev ? ' ws://127.0.0.1:* ws://localhost:*' : ''}`,
    "frame-src 'self'",
    "worker-src 'self' blob:",
  ].join('; '),
}
```

### Dashboard CSP (`apps/dashboard/next.config.mjs`)

Dashboard adds Cognito domains for OIDC auth flows:

```ts
const cognitoAuthDomain = process.env.AUTH_COGNITO_ISSUER
  ? new URL(process.env.AUTH_COGNITO_ISSUER).origin
  : '';

{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://*.clarity.ms`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    [
      "connect-src 'self'",
      'https://www.google-analytics.com',
      'https://*.clarity.ms',
      cognitoAuthDomain,
      'https://cognito-idp.us-east-2.amazonaws.com',
      isDev ? 'ws://127.0.0.1:* ws://localhost:*' : '',
    ].filter(Boolean).join(' '),
    `frame-src 'self' ${cognitoAuthDomain}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join('; '),
}
```

### Other security headers (both apps)

```ts
{ key: 'X-Frame-Options', value: 'DENY' },
{ key: 'X-Content-Type-Options', value: 'nosniff' },
{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
```

## Key Design Decisions

- `'unsafe-inline'` in `script-src` is required by Next.js for inline script injection (hydration, chunk loading)
- `'unsafe-eval'` is dev-only (required by Next.js hot module replacement)
- DynamoDB is called server-side from Lambda — no need in `connect-src`
- Cognito domain is derived dynamically from `AUTH_COGNITO_ISSUER` to avoid hardcoding the pool ID
- Google Analytics uses `googletagmanager.com` for the tag loader and `google-analytics.com` for the data endpoint

## Prevention

- When adding a new third-party service, update `connect-src` (and `script-src` if it loads JS)
- Test CSP violations in browser DevTools → Console → filter "Content-Security-Policy"
- Never add `'unsafe-eval'` to production builds — it undermines XSS protection

## Related

- `apps/website/next.config.mjs`
- `apps/dashboard/next.config.mjs`
- [MDN CSP Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)

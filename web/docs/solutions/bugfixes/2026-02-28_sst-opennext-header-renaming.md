---
title: SST/OpenNext renames CloudFront viewer headers to x-open-next-*
date: 2026-02-28
category: bugfixes
tags: [sst, opennext, cloudfront, headers, geo, middleware, locale]
app: website, dashboard
severity: high
---

# SST/OpenNext renames CloudFront viewer headers to x-open-next-*

## Problem

Middleware reads `CloudFront-Viewer-Country` (or `cloudfront-viewer-country`) to detect the visitor's country for locale redirection, but the header is always empty in production. Geo-detection works locally but breaks on CloudFront.

## Root Cause

SST v3's internal CloudFront Function (`router.ts`) intercepts viewer requests and renames CloudFront-specific headers before forwarding to the Lambda origin:

| Original Header | Renamed To |
|---|---|
| `cloudfront-viewer-country` | `x-open-next-country` |
| `cloudfront-viewer-city` | `x-open-next-city` |

The original header names do not exist by the time the request reaches Next.js middleware. Reading them will always return `null`.

## Solution

Always read `x-open-next-*` headers first, with fallback to the original names for forward-compatibility:

```ts
// apps/website/src/middleware.ts
const country =
  request.headers.get('x-open-next-country') ??
  request.headers.get('cloudfront-viewer-country');

const city =
  request.headers.get('x-open-next-city') ??
  request.headers.get('cloudfront-viewer-city');
```

## Prevention

- Rule in `MEMORY.md`: "SST/OpenNext header renaming: always read `x-open-next-*` first."
- When adding new CloudFront header reads, always check the OpenNext source for renamed equivalents.

## Related

- [`patterns/2026-02-28_staging-auth-cookie-gate.md`](../patterns/2026-02-28_staging-auth-cookie-gate.md)
- [OpenNext source — router.ts header renaming](https://github.com/opennextjs/opennextjs-aws)

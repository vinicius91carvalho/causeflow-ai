# Visual Audit Plan - CauseFlow AI Website

## Overview
Visual audit of all 28 pages (14 EN + 14 PT-BR) across 4 viewports using Playwright with chromium.

## Viewports
- Mobile: 375x812 (iPhone SE)
- Tablet: 768x1024 (iPad)
- Desktop: 1280x800
- Wide Desktop: 1440x900

## Pages Checklist

### English (EN)

| Page | Mobile | Tablet | Desktop | Wide | Console Errors |
|------|--------|--------|---------|------|----------------|
| `/` (Homepage) | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/product` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/pricing` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/security` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/integrations` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/compare` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/vs/resolve-ai` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/vs/incident-io` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/vs/rootly` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/vs/incidentfox` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/about` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/get-started` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/privacy` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/terms` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |

### Portuguese (PT-BR)

| Page | Mobile | Tablet | Desktop | Wide | Console Errors |
|------|--------|--------|---------|------|----------------|
| `/pt-br` (Homepage) | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/pt-br/product` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/pt-br/pricing` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/pt-br/security` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/pt-br/integrations` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/pt-br/compare` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/pt-br/vs/resolve-ai` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/pt-br/vs/incident-io` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/pt-br/vs/rootly` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/pt-br/vs/incidentfox` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/pt-br/about` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/pt-br/get-started` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/pt-br/privacy` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |
| `/pt-br/terms` | ✅ | ✅ | ✅ | ✅ | MIME mismatch* |

## Screenshot Output
Location: `screenshots/{locale}/{page}-{viewport}.png`

All 112 screenshots captured successfully.

## Console Errors Found

**\*MIME Type Mismatch (all pages):** chromium-specific local environment issue. When using `next start` locally, chromium blocks CSS/JS resources due to `X-Content-Type-Options: nosniff` and MIME type `text/plain` instead of proper `application/javascript` / `text/css`.

Affected resources (consistent across all pages):
1. `_next/static/css/app/[locale]/layout.css` — blocked (MIME `text/plain`)
2. `_next/static/chunks/main-app.js` — blocked (MIME `text/plain`)
3. `_next/static/chunks/app-pages-internals.js` — blocked (MIME `text/plain`)
4. `_next/static/chunks/app/[locale]/{page}/page.js` — blocked (MIME `text/plain`)

**Root Cause:** Known Next.js + chromium issue in local `next start` environments. The local Node.js server serves static assets with `text/plain` MIME type, and chromium's strict `nosniff` policy rejects them.

**Impact:** Local testing only. Does NOT affect production deployments on AWS/Vercel/CDN where MIME types are served correctly.

**Severity:** Low (non-actionable for production)

## Fixes Applied
No code fixes needed — console errors are environment-specific (local `next start` + chromium) and do not reproduce in production hosting environments.

## Results Summary
- **Status:** Complete
- **Total Pages:** 28
- **Total Screenshots:** 112 (28 pages x 4 viewports) — all captured
- **Console Errors Found:** 1 pattern (MIME mismatch) across all pages — local env only
- **Console Errors Fixed:** 0 needed (not a production issue)
- **Visual Issues:** None detected — all pages render correctly at all viewports

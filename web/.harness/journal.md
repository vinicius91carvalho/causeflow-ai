# QA Journal — WI-AC-015 (website staging-auth gate)

## Verdict: PASS

### Checks performed (black-box HTTP tests at PORT=5173 + static audit):

1. **Redirect to /staging-auth** ✅ — With `NEXT_PUBLIC_DEPLOYMENT_STAGE=staging` and `NEXT_PUBLIC_STAGING_PASSWORD=causeflow-staging-2026` set, `GET /` without `staging-authorized` cookie returns 307 to `/staging-auth`. Verified via curl (Test 1).

2. **Password form renders at /staging-auth** ✅ — `GET /staging-auth` returns HTTP 200 with the password form HTML (username + password input fields, "Access Staging" button, branded CauseFlow UI). Verified via curl (Test 4).

3. **Correct credentials set cookie and redirect** ✅ — Submitting `username=causeflow` and `password=causeflow-staging-2026` via Next.js server action (multipart POST with action metadata) returns HTTP 303 See Other to `/` with `Set-Cookie: staging-authorized=...; Path=/; HttpOnly; SameSite=lax; Max-Age=604800`. The cookie value is base64-encoded `staging-authorized:causeflow-staging-2026`. Verified via curl (Test 8).

4. **Valid cookie bypasses gate** ✅ — Request with valid `staging-authorized` cookie returns HTTP 200 (no redirect). Invalid cookie (wrong value) returns 307 to `/staging-auth`. Verified via curl (Test 5, Test 6).

5. **Local dev bypasses gate** ✅ — Without `NEXT_PUBLIC_DEPLOYMENT_STAGE=staging` (plain dev mode, PORT=5175), `GET /` returns HTTP 200 directly (no redirect). The `checkStagingAuth()` function returns `null` when `stage !== 'staging'`, confirmed via static code audit.

6. **Password source** ✅ — The documented password `causeflow-staging-2026` is read from `NEXT_PUBLIC_STAGING_PASSWORD` env var (sst.config.ts does not exist in OSS build per AC-050). Both sources provide the same password value. Password documented consistently in README.md, CLAUDE.md, docs/ and other references.

### Files audited statically:
- `packages/shared/src/infrastructure/middleware/staging-auth.ts` — checkStagingAuth + setStagingAuthCookie
- `apps/website/src/middleware.ts` — pipeline that calls checkStagingAuth
- `apps/website/src/contexts/shell/api/actions.ts` — authenticateStaging server action
- `apps/website/src/app/staging-auth/page.tsx` — thin re-export
- `apps/website/src/app/staging-auth/actions.ts` — thin re-export
- `apps/website/src/app/staging-auth/layout.tsx` — thin re-export
- `apps/website/src/contexts/shell/presentation/pages/staging-auth-page.tsx` — renders form
- `apps/website/src/contexts/shell/presentation/components/staging-auth-form.tsx` — client form
- `apps/website/src/contexts/shell/presentation/pages/staging-auth-layout.tsx` — dark-themed layout
- `.env.local` — no staging vars set (confirmed bypass)

### Verdict: PASS — All three AC-015 acceptance checks pass. No defects found.

---

# QA Journal — WI-AC-016 (website robots.ts + sitemap.ts + structured-data.tsx)

## Verdict: PASS

### Checks performed (black-box HTTP tests at PORT=5173):

1. **robots.txt — non-staging** ✅ — `GET /robots.txt` returns `User-Agent: *\nAllow: /\nSitemap: https://causeflow.ai/sitemap.xml`. Verified via curl.

2. **robots.txt — staging** ✅ — With `NEXT_PUBLIC_DEPLOYMENT_STAGE=staging`, `GET /robots.txt` returns `User-Agent: *\nDisallow: /`. Verified via curl.

3. **sitemap.xml** ✅ — `GET /sitemap.xml` returns XML with 24 `<loc>` entries (12 EN routes + 12 /pt-br/ routes). Routes covered: /, /product, /security, /integrations, /pricing, /about, /use-cases, /use-cases/stale-pricing, /use-cases/broken-images, /use-cases/cascading-500, /privacy, /terms. Verified via curl.

4. **JSON-LD on homepage** ✅ — Two `<script type="application/ld+json">` blocks found in `GET /` response. First contains `@type: Organization` (Organization schema). Second contains `@type: WebSite` (WebSite schema). Verified via curl + grep.

### Files audited:
- `apps/website/src/app/robots.ts` — returns `Disallow: /` when `NEXT_PUBLIC_DEPLOYMENT_STAGE === 'staging'`, otherwise `Allow: /`
- `apps/website/src/app/sitemap.ts` — generates 24 entry XML sitemap (12 routes × EN + PT-BR)
- `apps/website/src/contexts/marketing/presentation/components/structured-data.tsx` — exports Organization, WebSite, and FAQPage schemas; Organization + WebSite injected via root layout

### Verdict: PASS — All three AC-016 acceptance checks pass. No defects found.

## Re-verification (2026-07-09)

### Checks performed (black-box HTTP tests at PORT=5173):

1. **robots.txt — non-staging** ✅ — `GET /robots.txt` returns `User-Agent: *\nAllow: /\nSitemap: https://causeflow.ai/sitemap.xml`. Code path confirmed: when `NEXT_PUBLIC_DEPLOYMENT_STAGE=staging`, returns `Disallow: /`.

2. **sitemap.xml** ✅ — `GET /sitemap.xml` returns XML with 24 `<loc>` entries (12 EN routes + 12 /pt-br/ routes). Routes covered: /, /product, /security, /integrations, /pricing, /about, /use-cases, /use-cases/stale-pricing, /use-cases/broken-images, /use-cases/cascading-500, /privacy, /terms.

3. **JSON-LD on homepage** ✅ — Two `<script type="application/ld+json">` blocks found in `GET /` response. First contains `@type: Organization` (Organization schema). Second contains `@type: WebSite` (WebSite schema). Verified via curl + grep.

### Verdict: PASS — All three AC-016 acceptance checks pass. No code changes needed.

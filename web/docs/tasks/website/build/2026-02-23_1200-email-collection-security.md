# Email Collection + Security Protection

## Phase 1: Research & Setup
- [x] Read existing coming-soon-overlay.tsx
- [x] Read existing staging-auth route.ts
- [x] Read existing sst.config.ts
- [x] Read existing form types and index exports
- [x] Read packages/forms structure

## Phase 2: Forms Package Updates
- [x] Create notify-schema.ts (Zod validation for email)
- [x] Add NotifyFormData interface to form-types.ts
- [x] Update packages/forms/src/index.ts with new exports

## Phase 3: API Route + Rate Limiter
- [x] Create rate-limit.ts (in-memory sliding-window)
- [x] Create /api/notify/route.ts (POST endpoint with honeypot + rate limit + Formspree forwarding)

## Phase 4: Coming Soon Overlay Update
- [x] Update coming-soon-overlay.tsx with real API call, loading/error states, honeypot field

## Phase 5: Staging Auth Hardening
- [x] Add honeypot check + rate limiting to staging-auth route.ts

## Phase 6: SST Config — Formspree Env Var + AWS WAF
- [x] Add FORMSPREE_NOTIFY_ID env var to sst.config.ts
- [x] Add AWS WAF WebACL with managed rules + rate limiting
- [x] Link WAF to CloudFront via transform.cdn

## Phase 7: Build & Verify
- [x] pnpm turbo build — zero errors (5/5 packages)
- [x] pnpm turbo check-types — zero type errors
- [x] pnpm exec biome check — zero lint issues on changed files (pre-existing issues in other files unchanged)

# Replace Formspree with Loops.so Integration

## Overview
Replace all Formspree usage across the website with Loops.so server-side API. Remove Formspree entirely. Mock the get-started-free page. Update docs.

## Current State
- **3 Formspree submission paths:**
  1. `/api/notify/route.ts` — server-side email notification (homepage waitlist)
  2. `contact-modal.tsx` — client-side contact form (hardcoded ID `meelpdae`)
  3. `get-started-form.tsx` — client-side signup (already wrapped in ComingSoonOverlay)
- **Untracked files:** `submit-waitlist.ts` (Zoho), `waitlist-schema.ts` — to be replaced with Loops.so
- **Formspree infra:** `packages/forms/src/infrastructure/formspree/submit.ts`
- **Env vars:** `NEXT_PUBLIC_FORMSPREE_ID`, `FORMSPREE_NOTIFY_ID`, hardcoded `meelpdae`

## Phase 1: Research & Setup
- [x] Identify all files to modify (done in research)
- [x] Determine contact modal strategy → Adapt to Loops.so fields (firstName, email, companyName, companyWebsite)

## Phase 2: Implementation — Server Side
- [x] Rewrote `/api/notify/route.ts` with Loops.so integration (rate limiting, validation, honeypot preserved)
- [x] Contact modal now POSTs to `/api/notify` (unified endpoint)
- [x] Add `LOOPS_API_KEY` to `.env.local` (root) and `apps/website/.env.local`
- [x] Add `LOOPS_API_KEY` to GitHub Actions secrets (repo + staging + production environments)
- [x] Update `apps/website/sst.config.ts` — removed Formspree env vars, added `LOOPS_API_KEY`

## Phase 3: Implementation — Front End
- [x] Homepage ComingSoonOverlay already calls `/api/notify` — now routes to Loops.so
- [x] Rewrote `contact-modal.tsx` — Loops.so fields (firstName, email, companyName, companyWebsite), POSTs to `/api/notify`
- [x] Made `get-started-form.tsx` truly inert (mock onSubmit, removed submitToFormspree import)
- [x] Updated CSP headers in `next.config.mjs` — replaced `formspree.io` with `app.loops.so`

## Phase 4: Remove Formspree
- [x] Deleted `packages/forms/src/infrastructure/formspree/` directory
- [x] Removed Formspree exports from `packages/forms/src/index.ts`
- [x] Updated `.env.example` — replaced Formspree vars with `LOOPS_API_KEY`
- [x] Removed Formspree env vars from `apps/website/sst.config.ts`
- [x] `/api/notify/route.ts` rewritten (no separate removal needed)
- [x] Deleted untracked Zoho `submit-waitlist.ts`
- [x] Updated privacy page — Formspree → Loops
- [x] Added waitlistSchema export to forms package index

## Phase 5: Validation
- [x] Run `pnpm turbo build` — 7 packages built, 33+49 static pages generated
- [x] Run `pnpm turbo check-types` — all 7 packages pass
- [x] Run `pnpm exec biome check .` — 0 errors, 47 pre-existing warnings
- [x] Test forms locally with Playwright
- [x] Check screenshots for visual integrity

## Phase 6: Compound
- [x] Update `apps/website/CLAUDE.md` — routes, key files, dependencies, CSP all updated
- [x] Update `docs/apps/website/` — README.md and components.md updated
- [x] Update root `CLAUDE.md` — Tech Stack: Formspree → Loops.so
- [x] Update `.env.example` — replaced Formspree vars with `LOOPS_API_KEY`
- [x] Updated 12 documentation files across docs/, apps/, and root
- [x] Add learnings to session-learnings.md

## Learnings

- **Formspree was not an npm package** — it was called via raw `fetch`, so removal was about deleting the internal wrapper + updating callers, not uninstalling a dependency
- **Unified API endpoint pattern works well** — both the homepage email-only form and the contact modal with full fields can POST to the same `/api/notify` route; the Loops.so API accepts optional fields gracefully
- **Three submission paths collapsed to one** — Formspree had client-direct (contact modal), server-proxy (notify), and server-action (Zoho waitlist). Now everything goes through one server-side `/api/notify` → Loops.so
- **CSP headers matter** — had to update `connect-src` in next.config.mjs; without this, client-side fetches to the API route that proxies to Loops.so would work, but any direct calls would be blocked
- **Env var naming** — `LOOPS_API_KEY` is server-only (no `NEXT_PUBLIC_` prefix), which is correct since all Loops.so calls go through our API route, never from the browser directly

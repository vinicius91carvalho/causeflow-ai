# PRD: Onboarding Plan-Gate Enforcement

**Date:** 2026-04-08
**Author:** Vinicius Carvalho (via Claude Code `/plan`)
**Mode:** Standard
**Area:** dashboard / billing + identity
**Status:** DRAFT — ready for execution (decisions locked in)

---

## 0. Architectural Constraint (HARD RULE)

**Stripe logic MUST live in CORE-API, NOT in the dashboard.** The dashboard is a thin proxy that forwards billing requests to Core over HTTP. No `stripe` SDK imports, no webhook signature verification, no Stripe types beyond response DTOs in the dashboard.

### Current Violation (discovered during planning)
The dashboard currently imports the `stripe` npm package directly in **3 files**:
- `apps/dashboard/src/contexts/billing/infrastructure/stripe-client.ts`
- `apps/dashboard/src/contexts/billing/infrastructure/webhook-handlers.ts`
- `apps/dashboard/src/contexts/billing/application/services.ts`

And `apps/dashboard/.env.local` contains secret Stripe keys that should only exist in Core:
```
STRIPE_SECRET_KEY=sk_test_51T71Au...
STRIPE_WEBHOOK_SECRET=whsec_84KlDn...
STRIPE_STARTER_PRICE_ID=price_1T71zs...
STRIPE_PRO_PRICE_ID=price_1T71zt...
STRIPE_BUSINESS_PRICE_ID=price_1T71zv...
```

### Keys Audit
| Env | File | Status |
|---|---|---|
| Dashboard | `apps/dashboard/.env.local` | ❌ Contains secret Stripe keys (should be moved) |
| Core | `core/.env.local` | ❌ **DOES NOT EXIST** — must be created |
| Core | `core/.env.example` | ❌ No STRIPE_* entries — must be documented |

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is the only Stripe var that may remain in the dashboard (it's a public key used by Stripe.js client-side).

### Remediation (part of this PRD's scope)
1. Create `core/.env.local` with all `STRIPE_*` values migrated from dashboard.
2. Add `STRIPE_*` entries to `core/.env.example` (documented, no real values).
3. Remove `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and all `STRIPE_*_PRICE_ID` from `apps/dashboard/.env.local`. Keep only `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
4. Delete `apps/dashboard/src/contexts/billing/infrastructure/stripe-client.ts`.
5. Refactor `webhook-handlers.ts` and `services.ts` to either be deleted or rewritten as thin Core-API proxies (no `import Stripe from 'stripe'`).
6. Webhook endpoint on dashboard → remove entirely OR forward raw body to Core `POST /v1/billing/webhook` (Core owns signature verification). **Prefer:** point Stripe webhooks directly at Core's public URL; delete the dashboard webhook route.
7. Uninstall `stripe` from `apps/dashboard/package.json` (keep `@stripe/stripe-js` for publishable-key client usage only).

---

## 1. Intent

After signup, a user must complete a linear onboarding funnel:

1. **Sign up** via Clerk `<SignUp>` (email/password or OAuth).
2. **Create Organization** via Clerk `<CreateOrganization>` — org name + logo ("description" + "photo"). Already implemented.
3. **Select a Plan** at `/onboarding/choose-plan`. Hits Core API `POST /v1/billing/checkout`, which creates a Stripe customer + Checkout Session. User completes payment in Stripe Checkout.
4. On return to `/dashboard?welcome=1`, the Stripe customer must be visible in [`dashboard.stripe.com/acct_1T71AuAcBi1YRd2c/test/customers`](https://dashboard.stripe.com/acct_1T71AuAcBi1YRd2c/test/customers).

**Hard requirement:** Until a user has a subscription in `active` or `trialing` status, the **only** route they can reach (beyond auth + org creation) is `/onboarding/choose-plan`. Every other route must redirect there.

---

## 2. Current State

Already implemented (verified by reading the codebase):

| Step | File |
|---|---|
| Sign up → redirect to `/create-organization` | `apps/dashboard/src/app/[locale]/auth/sign-up/[[...sign-up]]/page.tsx` |
| Clerk `<CreateOrganization>` → redirect to `/onboarding/choose-plan` | `apps/dashboard/src/app/[locale]/create-organization/[[...create-organization]]/page.tsx` |
| Choose-plan UI (3 plans + fallback + i18n) | `apps/dashboard/src/contexts/billing/presentation/pages/choose-plan-page.tsx` |
| `POST /api/billing/checkout` → Core API → Stripe | `apps/dashboard/src/contexts/billing/api/checkout-handler.ts` |
| Stripe customer creation | `core/src/modules/billing/infra/stripe-customer.service.ts` |
| `SubscriptionGate` client component blocks `/dashboard/*` | `apps/dashboard/src/contexts/billing/presentation/components/subscription-gate.tsx` (wrapped in `app/[locale]/dashboard/layout.tsx`) |
| `GET /api/billing/subscription` (plan/status from Stripe) | `apps/dashboard/src/contexts/billing/api/subscription-handler.ts` |

---

## 3. Gaps

### Gap 1 — No server-side plan gate (only client-side)
`SubscriptionGate` is mounted only in the dashboard layout and runs client-side. A user can briefly see dashboard chrome before redirect. More importantly, **no enforcement exists at the middleware layer** for non-dashboard routes.

### Gap 2 — `/onboarding(.*)` is entirely public in middleware
`apps/dashboard/src/middleware.ts` treats every `/onboarding/*` route as public. A signed-in user with no plan can reach `/onboarding/welcome`, `/onboarding/connect-aws`, or any other onboarding sub-route without picking a plan.

### Gap 3 — No E2E verification that Stripe customer appears
The flow has never been end-to-end verified (signup → plan → Stripe test card `4242 4242 4242 4242` → `dashboard?welcome=1` → customer visible in test dashboard).

### Gap 4 — Dead `/onboarding/complete-profile` route
`complete-profile-page.tsx` still exists but is orphaned — Clerk's `<CreateOrganization>` now owns photo+name capture. Dead code.

---

## 4. Locked-In Decisions

### D1 — Gate architecture: **Option B (cookie + webhook + fallback)** ✅
- Dashboard sets a signed `cf_plan_active=1` cookie after confirming plan on `?welcome=1` return.
- Core-API webhook handler (NOT dashboard) marks tenant plan state on `customer.subscription.deleted` / `paused`; dashboard clears its cookie on next request when Core reports non-active state.
- Middleware reads cookie only — zero network on the happy path.
- Fallback: on cache miss, middleware fetches `GET /v1/billing/subscription` from Core API (server-to-server, 30s revalidate).
- Rationale: cookie read is free; Core's webhook keeps state honest; fallback handles edge cases (cleared cookies, cross-device, first load).

### D2 — Orphaned routes: **Delete `complete-profile`** ✅
- Delete `apps/dashboard/src/app/[locale]/onboarding/complete-profile/`.
- Delete `apps/dashboard/src/contexts/identity/presentation/pages/complete-profile-page.tsx` and any associated tests.
- Leave `/onboarding/welcome` and `/onboarding/connect-aws` in place (gated — see D3).

### D3 — Pre-plan reachability: **Plan required first** ✅
- Before a user has an `active`/`trialing` plan, the ONLY reachable app routes are:
  - `/auth/*` (Clerk)
  - `/create-organization` (Clerk)
  - `/onboarding/choose-plan`
  - `/api/billing/*` (proxy endpoints so the checkout flow works)
  - Stripe Checkout return URL (`/dashboard?welcome=1` — the gate sees the cookie after checkout completes)
- Everything else — including `/onboarding/welcome`, `/onboarding/connect-aws`, `/dashboard/*`, `/pt-br/*` equivalents, and the root `/` — redirects to `/onboarding/choose-plan`.

### D4 — Stripe test env: **AUDITED** ✅
- ✅ Dashboard has keys in `apps/dashboard/.env.local` (but this is WRONG per §0 — they must move to Core).
- ❌ `core/.env.local` does not exist yet. Must be created as part of execution.
- ❌ `core/.env.example` has no `STRIPE_*` entries. Must be added.
- Stripe account confirmed: `acct_1T71AuAcBi1YRd2c` (`sk_test_51T71Au...`).
- Price IDs already exist: `price_1T71zs...` (Starter), `price_1T71zt...` (Pro), `price_1T71zv...` (Business).

---

## 5. Scope

### A. Plan-Gate Enforcement (dashboard)

**Modify:**
- `apps/dashboard/src/middleware.ts` — Add plan-gate step after Clerk `auth.protect()` and org check. Allowlist: `/auth/*`, `/create-organization`, `/onboarding/choose-plan`, `/api/billing/*`. Everything else → redirect to `/onboarding/choose-plan` when `cf_plan_active` cookie is missing/invalid. Tighten `/onboarding(.*)` matcher.
- `apps/dashboard/src/app/[locale]/dashboard/page.tsx` (or a new post-checkout handler at `/api/billing/checkout/success`) — Fetch subscription from Core; if `active`/`trialing`, set signed `cf_plan_active` cookie.
- `apps/dashboard/src/contexts/billing/presentation/components/subscription-gate.tsx` — Keep as client-side defense in depth; primary enforcement is middleware.

**Create:**
- `apps/dashboard/src/contexts/billing/infrastructure/plan-gate-cookie.ts` — Sign/verify/read `cf_plan_active` cookie using Web Crypto `SubtleCrypto` HMAC (Edge-safe), secret from `PLAN_GATE_SECRET` env var.
- `apps/dashboard/src/middleware.test.ts` — Vitest unit tests: no-plan redirect from `/dashboard`, `/onboarding/welcome`, `/`; active-plan passthrough; `/onboarding/choose-plan` allowlist; `/api/billing/*` allowlist; cookie tamper-rejection; fallback to Core fetch on missing cookie.
- `tests/onboarding-plan-gate.spec.ts` — Playwright E2E: fresh signup → Clerk create-org → choose plan → Stripe test card `4242 4242 4242 4242` → return to dashboard → verify (via Core API call or Stripe API query with the test secret) that the customer exists in `acct_1T71AuAcBi1YRd2c`.

**Delete:**
- `apps/dashboard/src/app/[locale]/onboarding/complete-profile/` (entire directory).
- `apps/dashboard/src/contexts/identity/presentation/pages/complete-profile-page.tsx`.
- Any tests referencing the above.

---

### B. Stripe Relocation (dashboard → CORE-API)

**Delete from dashboard:**
- `apps/dashboard/src/contexts/billing/infrastructure/stripe-client.ts` — dashboard must not instantiate Stripe SDK.
- `apps/dashboard/src/contexts/billing/infrastructure/webhook-handlers.ts` — webhook handling belongs in Core.
- `apps/dashboard/src/app/[locale]/api/billing/webhook/route.ts` (if present) — Stripe webhooks point at Core's public URL, not the dashboard.
- `stripe` dependency from `apps/dashboard/package.json` (run `pnpm --filter @causeflow/dashboard remove stripe`). Keep `@stripe/stripe-js` (publishable-key only).

**Modify in dashboard:**
- `apps/dashboard/src/contexts/billing/application/services.ts` — remove `import Stripe from 'stripe'`. Refactor to pure HTTP proxy to Core. If the file becomes trivial, inline into the API handlers and delete.
- `apps/dashboard/src/contexts/billing/api/checkout-handler.ts`, `subscription-handler.ts`, `portal-handler.ts`, `plans-handler.ts`, `subscribe-handler.ts` — verify they call Core API exclusively (spot-check each).
- `apps/dashboard/src/contexts/billing/domain/stripe-types.ts` — keep only DTOs for Core API responses; remove any direct re-exports from `stripe` package types.

**Modify in dashboard env:**
- `apps/dashboard/.env.local` — REMOVE `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID`, `STRIPE_BUSINESS_PRICE_ID`. Keep `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Add `PLAN_GATE_SECRET` (32-byte hex).
- `apps/dashboard/.env.example` — reflect the same changes (add `PLAN_GATE_SECRET`, remove server-side Stripe keys).

**Create / modify in CORE-API:**
- `core/.env.local` — **create new file**. Contents:
  ```
  STRIPE_SECRET_KEY=sk_test_51T71Au...
  STRIPE_WEBHOOK_SECRET=whsec_84KlDn...
  STRIPE_STARTER_PRICE_ID=price_1T71zs...
  STRIPE_PRO_PRICE_ID=price_1T71zt...
  STRIPE_BUSINESS_PRICE_ID=price_1T71zv...
  ```
- `core/.env.example` — add documented `STRIPE_*` entries (no real values).
- `core/src/shared/config/index.ts` — verify all `STRIPE_*` env vars are loaded and validated (already imports `stripe` — should already be in place).
- `core/src/modules/billing/infra/billing.routes.ts` — verify the webhook route exists and is publicly accessible (Stripe calls it directly). If missing, add `POST /v1/billing/webhook` using `handle-webhook.usecase.ts` (already present).
- Spot-check that `core/src/modules/billing/application/create-checkout.usecase.ts`, `handle-webhook.usecase.ts`, and `stripe-customer.service.ts` cover every operation the dashboard previously did locally.

**Stripe Dashboard config (manual step — document in Agent Notes):**
- Point the Stripe test webhook endpoint at Core's public URL: `https://<core-api-host>/v1/billing/webhook` (exact URL TBD by user).
- Remove the old dashboard webhook endpoint if one exists in the Stripe dashboard.

### Files Read-Only (context)
- `apps/dashboard/src/contexts/billing/api/checkout-handler.ts`
- `apps/dashboard/src/contexts/billing/api/subscription-handler.ts`
- `apps/dashboard/src/contexts/billing/presentation/pages/choose-plan-page.tsx`
- `core/src/modules/billing/infra/stripe-customer.service.ts`
- `core/src/modules/billing/infra/billing.routes.ts`

---

## 6. Acceptance Criteria

- [ ] Signed-in user with no org → redirected to `/create-organization`.
- [ ] Signed-in user with org but no plan → redirected to `/onboarding/choose-plan` **from every other route** (`/dashboard`, `/dashboard/settings`, `/onboarding/welcome`, `/onboarding/connect-aws`, `/`, `/pt-br/dashboard`, etc.).
- [ ] Signed-in user with org + `active`/`trialing` plan → normal access to all routes.
- [ ] The `/onboarding/choose-plan` route itself is reachable (no redirect loop).
- [ ] API routes under `/api/billing/*` are reachable pre-plan (checkout flow must work).
- [ ] Clicking a plan on `/onboarding/choose-plan` creates a Stripe customer visible at `dashboard.stripe.com/acct_1T71AuAcBi1YRd2c/test/customers` with correct tenant metadata.
- [ ] Using Stripe test card `4242 4242 4242 4242` → return to `/dashboard?welcome=1` → no redirect back to choose-plan → dashboard renders.
- [ ] Cancelling subscription in Stripe dashboard → next request → user redirected back to `/onboarding/choose-plan`.
- [ ] Dead `/onboarding/complete-profile` route removed.
- [ ] Dashboard has zero `import ... from 'stripe'` statements (`grep -r "from 'stripe'" apps/dashboard/src` returns empty).
- [ ] Dashboard `package.json` no longer lists `stripe` (only `@stripe/stripe-js` for publishable-key use).
- [ ] `apps/dashboard/.env.local` contains no `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or `STRIPE_*_PRICE_ID`.
- [ ] `core/.env.local` exists and contains all migrated `STRIPE_*` values.
- [ ] `core/.env.example` documents all `STRIPE_*` entries.
- [ ] Stripe webhook endpoint points at Core's URL (verified in Stripe test dashboard).
- [ ] Core's `POST /v1/billing/webhook` correctly verifies signatures against `STRIPE_WEBHOOK_SECRET`.
- [ ] Middleware unit tests cover: no-plan redirect, active-plan passthrough, choose-plan allowlist, `/api/billing/*` allowlist, cookie verification tamper-rejection.
- [ ] Playwright E2E passes on chromium.
- [ ] Both dev-server console and browser console are clean across signup → org → plan → dashboard flow.
- [ ] `pnpm exec biome check .` + `pnpm turbo check-types` pass.

---

## 7. Anti-Goodhart Checks

- Tests verify actual REDIRECT behavior, not just the presence of middleware code.
- E2E tests the USER flow (Clerk widget click → Stripe hosted page → return), not a mocked internal redirect.
- Verify the Stripe customer appears in the **real test dashboard**, not just that the API call returned 200.
- Non-admin / fresh test account used for E2E — not the developer's existing authenticated session.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Cookie-based gate drifts from real Stripe state | Webhook clears cookie on cancel/pause; middleware falls back to live fetch if cookie missing |
| Middleware adds latency on every request | Cookie path is zero-network; fallback cached 30s |
| Edge runtime can't do HMAC | Use Web Crypto `SubtleCrypto` (available on Edge) |
| Clerk `auth.protect()` order matters | Plan gate runs AFTER Clerk auth and org check, not before |
| Stripe webhook not configured in dev | Document in `.env.local.example`; fallback to live fetch covers the gap |

---

## 9. Out of Scope

- Billing UI beyond the gate (subscription management, invoices, plan upgrades).
- Multi-seat / per-user billing changes.
- PT-BR translation review (strings already exist in `billing/infrastructure/i18n/`).
- Refactoring `SubscriptionGate` client component — keep as defense in depth.
- Populating `/onboarding/welcome` or `/onboarding/connect-aws` content.

---

## 10. Execution Notes

- **Mode:** Standard, now slightly larger due to the Stripe relocation. ~8 files modified, ~4 created, ~5 deleted, 2 repos touched (`web` + `core`).
- **Cross-repo coordination:** Core-API changes land in `/root/projects/causeflow/core`; dashboard changes land in `/root/projects/causeflow/web`. Commit separately per repo.
- **TDD order:** Write middleware unit tests first (red), implement gate (green), then Playwright E2E.
- **Verification:** Dev server + Playwright MCP loop per the Anti-Premature Completion Protocol. Screenshots to `.artifacts/playwright/screenshots/2026-04-08_1325/`.
- **Do NOT start execution** until D1–D4 are answered.

---

## Agent Notes
(Filled during execution)

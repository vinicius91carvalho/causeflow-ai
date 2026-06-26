---
title: Stripe Subscription Integration Pattern
date: 2026-03-03
category: patterns
tags: [stripe, subscriptions, webhooks, billing, credits, checkout, portal]
app: dashboard
severity: high
---

# Stripe Subscription Integration Pattern

## Problem
CauseFlow AI needed automated billing with self-service plan management, credit renewal tied to billing cycles, and graceful subscription lifecycle handling.

## Solution

### Architecture
- **Stripe Checkout** for new subscriptions (hosted by Stripe)
- **Stripe Customer Portal** for subscription management (update payment, cancel, invoices)
- **Webhooks** for server-side subscription lifecycle handling
- **Shared plan config** as single source of truth for all plan data
- **Tenant metadata in Stripe** instead of DynamoDB GSI for customer↔tenant mapping

### Subscription State Machine
```
(no subscription) → active → canceling → canceled → (reverts to free)
                       ↓                                    ↑
                   past_due → (retry) → active              │
                       └→ (all retries fail) → canceled ────┘
```

### Key Design Decisions

1. **Stripe metadata over DynamoDB GSI**: Store `tenantId` in Stripe customer/subscription metadata. Webhook handlers extract tenantId from event metadata rather than querying DynamoDB by stripeCustomerId. No schema changes needed.

2. **Dual credit renewal**: Paid plans renew credits via `invoice.paid` webhook. Free plans use lazy renewal (reset on next API call after 30 days). Prevents double-renewal.

3. **Graceful cancellation**: `canceling` status keeps credits active until `currentPeriodEnd`. After period end, lazy revert to Free plan happens on next metrics fetch.

4. **Upgrade vs downgrade**: Upgrades reset credits immediately (user gets new quota). Downgrades keep current credits until next renewal cycle.

5. **Idempotent webhook handlers**: Processing the same event twice produces the same state. Prevents duplicate credit resets from webhook retries.

### Stripe SDK v20 Breaking Changes
- `Subscription.current_period_end` moved to `SubscriptionItem.current_period_end`
- `Invoice.subscription` moved to `Invoice.parent.subscription_details.subscription`
- Access via helper functions that navigate the new type hierarchy.

### File Structure
```
packages/shared/src/domain/constants/plans.ts    # Plan config (single source of truth)
apps/dashboard/src/lib/stripe/
  ├── client.ts              # Stripe SDK singleton
  ├── service.ts             # Business logic (checkout, portal, webhooks)
  ├── webhook-handlers.ts    # 5 event handlers
  ├── types.ts               # Stripe-specific types
  └── index.ts               # Barrel export
apps/dashboard/src/app/api/billing/
  ├── checkout/route.ts      # POST - Create Checkout session
  ├── portal/route.ts        # POST - Create Portal session
  ├── webhook/route.ts       # POST - Handle Stripe webhooks
  └── subscription/route.ts  # GET - Current subscription state
```

### Webhook Events Handled
| Event | Handler | Action |
|---|---|---|
| `checkout.session.completed` | `handleCheckoutComplete` | Activate subscription, reset credits to plan quota |
| `customer.subscription.updated` | `handleSubscriptionUpdated` | Sync plan/status changes (upgrades, downgrades, cancellation scheduling) |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Revert tenant to Free plan with 5 credits |
| `invoice.paid` | `handleInvoicePaid` | Renew credits for paid plans each billing cycle |
| `invoice.payment_failed` | `handlePaymentFailed` | Mark tenant as `past_due`, preserve remaining credits |

### Plans Configuration (Single Source of Truth)
```typescript
// packages/shared/src/domain/constants/plans.ts
export const PLANS: Record<TenantPlan, PlanConfig> = {
  free:       { id: 'free',       credits: 5,        price: 0 },
  starter:    { id: 'starter',    credits: 100,       price: 4900 },  // $49/mo in cents
  pro:        { id: 'pro',        credits: 500,       price: 14900 }, // $149/mo in cents
  business:   { id: 'business',   credits: 2000,      price: 39900 }, // $399/mo in cents
  enterprise: { id: 'enterprise', credits: Infinity,  price: null },  // Contact Sales
};
```

### Webhook Endpoint Setup
```typescript
// apps/dashboard/src/app/api/billing/webhook/route.ts
// IMPORTANT: Must NOT use withAuth() — Stripe sends raw POST
// IMPORTANT: Must use NextRequest (not Request) for body reading
export async function POST(request: NextRequest) {
  const body = await request.text(); // raw body for signature verification
  const signature = request.headers.get('stripe-signature');
  // verify → handle → return 200
}
```

### Tenant ID Lookup (metadata pattern)
```typescript
// In webhook handlers — no DynamoDB GSI needed
const tenantId = event.data.object.metadata?.tenantId
  ?? event.data.object.customer_details?.metadata?.tenantId;
// Always store tenantId in Stripe customer + subscription metadata
```

## Prevention
- Always pin Stripe API version in client initialization
- Always verify webhook signatures before processing
- Always use `cancel_at_period_end` for cancellations (never immediate cancel)
- Never expose `STRIPE_SECRET_KEY` to client code
- Never use `withAuth` on webhook endpoints (Stripe sends raw POST)
- When reading `Subscription.current_period_end` in SDK v20+, use `subscription.items.data[0]?.current_period_end` (moved from top-level)
- When reading `Invoice.subscription` in SDK v20+, use `invoice.parent?.subscription_details?.subscription`

## Related
- `apps/dashboard/CLAUDE.md` — billing routes and env vars
- `docs/apps/dashboard/api-reference.md` — billing API documentation
- `packages/shared/src/domain/constants/plans.ts` — plan config source of truth

'use client';

import type { PlanConfig, TenantPlan } from '@causeflow/shared/constants';
import { getSelfServicePlans, PLANS } from '@causeflow/shared/constants';
import { useCallback, useEffect, useState } from 'react';
import { PERMISSION } from '@/contexts/identity/domain/rbac/permissions';
import { usePermission } from '@/contexts/identity/domain/rbac/role-guard';
import { BillingFooter, InlineToast, ManageSubscriptionButton } from './billing-cta';
import type { BillingMessages, SubscriptionData } from './billing-types';
import { InvoicesTable } from './invoices-table';
import { PaymentModal } from './payment-modal';
import { PlanCard, PlanCardSkeleton } from './plan-card';
import { QuotaPackModal } from './quota-pack-modal';
import { CreditsBar, CreditsSkeleton, StatusAlert } from './subscription-status';
import { UsageHistory } from './usage-history';

// ---------------------------------------------------------------------------
// Plan ordering
// ---------------------------------------------------------------------------

const PLAN_ORDER: TenantPlan[] = ['starter', 'pro', 'business', 'enterprise'];

/** Backend plan shape from GET /api/billing/plans */
interface BackendPlan {
  planKey: string;
  name: string;
  priceUsd: number;
  priceAnnualUsd?: number;
  investigationsLimit: number;
  eventsLimit: number;
  trialDays: number;
  features: string[];
  highlighted?: boolean;
  selfService: boolean;
  overagePerInvestigation?: number;
}

/** Display names for plans (Stripe product name is generic "CauseFlow Platform") */
const PLAN_DISPLAY_NAMES: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
};

/** Convert backend plan to frontend PlanConfig */
function backendToConfig(bp: BackendPlan): PlanConfig {
  return {
    id: bp.planKey as TenantPlan,
    name: PLAN_DISPLAY_NAMES[bp.planKey] ?? bp.planKey,
    price: bp.priceUsd,
    credits: bp.investigationsLimit,
    overagePerCredit: bp.overagePerInvestigation ?? 0,
    selfService: bp.selfService,
    stripePriceEnvVar: null,
    features: bp.features,
  };
}

function getPlanIndex(plan: TenantPlan): number {
  return PLAN_ORDER.indexOf(plan);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BillingPageProps {
  messages: BillingMessages;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BillingPage({ messages }: BillingPageProps) {
  const canManageBilling = usePermission(PERMISSION.MANAGE_BILLING);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPlanId, setLoadingPlanId] = useState<TenantPlan | 'portal' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [backendPlans, setBackendPlans] = useState<PlanConfig[] | null>(null);
  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    clientSecret: string | null;
    planId: TenantPlan;
    planName: string;
    isTrialing: boolean;
  }>({ open: false, clientSecret: null, planId: 'starter', planName: '', isTrialing: false });

  // Fetch plans from backend (Stripe catalog)
  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/plans');
      if (res.ok) {
        const data = (await res.json()) as { plans: BackendPlan[] };
        if (data.plans.length > 0) {
          setBackendPlans(data.plans.map(backendToConfig));
        }
      }
    } catch {
      // Fallback to hardcoded PLANS
    }
  }, []);

  useEffect(() => {
    void fetchPlans();
  }, [fetchPlans]);

  // Fire confetti when Stripe redirects back with ?success=1 after a successful upgrade
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === '1') {
      planSelectConfetti();
      // Remove the query param so confetti doesn't replay on refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      url.searchParams.delete('plan');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Fetch subscription data
  useEffect(() => {
    let cancelled = false;

    async function fetchSubscription() {
      try {
        const res = await fetch('/api/billing/subscription');
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as SubscriptionData;
          setSubscription(data);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchSubscription();
    return () => {
      cancelled = true;
    };
  }, []);

  // Handle checkout — opens the OSS billing-disabled modal (AC-048).
  // Stripe Payment Element / subscribe flow removed; the modal POSTs to
  // /api/billing/checkout which proxies Core's StubBillingService (410).
  function handleCheckout(planId: TenantPlan) {
    setLoadingPlanId(planId);
    setErrorMessage(null);
    const plan = displayPlans.find((p) => p.id === planId);
    setPaymentModal({
      open: true,
      clientSecret: null,
      planId,
      planName: plan?.name ?? planId,
      isTrialing: false,
    });
    setLoadingPlanId(null);
  }

  // Handle Stripe Customer Portal
  async function handlePortal() {
    setLoadingPlanId('portal');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const json = (await res.json()) as { url?: string; error?: string };
      if (res.ok && json.url) {
        window.open(json.url, '_blank', 'noopener,noreferrer');
        setLoadingPlanId(null);
      } else {
        setErrorMessage(json.error ?? messages.portalError);
        setLoadingPlanId(null);
      }
    } catch {
      setErrorMessage(messages.portalError);
      setLoadingPlanId(null);
    }
  }

  const currentPlan: TenantPlan = subscription?.plan ?? 'starter';
  const currentPlanIndex = getPlanIndex(currentPlan);

  // Use backend plans if available, fallback to hardcoded
  const selfService = backendPlans ?? getSelfServicePlans();
  const displayPlans: PlanConfig[] = [...selfService, PLANS.enterprise];

  return (
    <div className="space-y-6">
      {/* Error toast */}
      {errorMessage && (
        <InlineToast message={errorMessage} type="error" onDismiss={() => setErrorMessage(null)} />
      )}

      {/* Success toast */}
      {successMessage && (
        <InlineToast
          message={successMessage}
          type="success"
          onDismiss={() => setSuccessMessage(null)}
        />
      )}

      {/* Status alert (canceling / past_due) */}
      {subscription && <StatusAlert subscription={subscription} messages={messages} />}

      {/* Credits bar */}
      {loading ? (
        <CreditsSkeleton />
      ) : subscription ? (
        <CreditsBar subscription={subscription} messages={messages} />
      ) : null}

      {/* Manage Subscription button */}
      {subscription?.hasStripeCustomer && (
        <ManageSubscriptionButton
          loadingPlanId={loadingPlanId}
          messages={messages}
          onPortal={() => void handlePortal()}
        />
      )}

      {/* Usage History */}
      {!loading && <UsageHistory messages={messages} onBuyMore={() => setQuotaModalOpen(true)} />}

      {/* Plan cards — admins only. Members see read-only credits/status above. */}
      {canManageBilling && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mx-auto max-w-6xl">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                <PlanCardSkeleton key={i} />
              ))
            : displayPlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  currentPlan={currentPlan}
                  currentPlanIndex={currentPlanIndex}
                  subscription={
                    subscription ?? {
                      plan: currentPlan,
                      subscriptionStatus: null,
                      creditsTotal: PLANS.starter.credits,
                      creditsUsed: 0,
                      creditsRemaining: PLANS.starter.credits,
                      currentPeriodEnd: null,
                      cancelAtPeriodEnd: false,
                      hasStripeCustomer: false,
                    }
                  }
                  messages={messages}
                  onCheckout={handleCheckout}
                  loadingPlanId={loadingPlanId}
                />
              ))}
        </div>
      )}

      {/* Invoices */}
      {!loading && subscription?.hasStripeCustomer && <InvoicesTable messages={messages} />}

      {/* Footer note */}
      <BillingFooter />

      {/* Payment modal — OSS billing-disabled panel (AC-048) */}
      <PaymentModal
        open={paymentModal.open}
        clientSecret={paymentModal.clientSecret}
        planName={paymentModal.planName}
        planId={paymentModal.planId}
        isTrialing={paymentModal.isTrialing}
        onClose={() => setPaymentModal((prev) => ({ ...prev, open: false }))}
        onSuccess={() => {
          setPaymentModal((prev) => ({ ...prev, open: false }));
        }}
        onError={(msg) => setErrorMessage(msg)}
      />

      {/* Quota Pack purchase modal */}
      <QuotaPackModal
        open={quotaModalOpen}
        onClose={() => setQuotaModalOpen(false)}
        messages={messages}
        onSuccess={(msg) => setSuccessMessage(msg)}
        onError={(msg) => setErrorMessage(msg)}
      />
    </div>
  );
}

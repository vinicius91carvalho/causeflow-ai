'use client';

import { SITE } from '@causeflow/shared/constants';
import { cn } from '@causeflow/ui/lib';
import { Check, Loader2, LogOut, Mail, Shield, Sparkles, Zap } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/shared/presentation/components/auth-context';
import { CauseFlowLoader } from '@/contexts/shared/presentation/components/causeflow-loader';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BackendPlan {
  planKey: string;
  name: string;
  priceUsd: number;
  investigationsLimit: number;
  eventsLimit: number;
  trialDays: number;
  features: string[];
  selfService: boolean;
}

// Fallback plans if backend is not reachable
const FALLBACK_PLANS: BackendPlan[] = [
  {
    planKey: 'starter',
    name: 'Starter',
    priceUsd: 99,
    investigationsLimit: 15,
    eventsLimit: 500,
    trialDays: 7,
    features: [
      '15 investigations/month',
      '500 events/month',
      'All integrations',
      'Audit trail',
      'Knowledge Base',
      'Remediation (PRs)',
      'RBAC',
      'Email support',
    ],
    selfService: true,
  },
  {
    planKey: 'pro',
    name: 'Pro',
    priceUsd: 349,
    investigationsLimit: 60,
    eventsLimit: 3000,
    trialDays: 7,
    features: [
      '60 investigations/month',
      '3,000 events/month',
      'All integrations',
      'Audit trail',
      'Knowledge Base',
      'Remediation (PRs)',
      'RBAC',
      'Email + WhatsApp support',
    ],
    selfService: true,
  },
  {
    planKey: 'business',
    name: 'Business',
    priceUsd: 899,
    investigationsLimit: 200,
    eventsLimit: 10000,
    trialDays: 7,
    features: [
      '200 investigations/month',
      '10,000 events/month',
      'All integrations',
      'Audit trail',
      'Knowledge Base',
      'Remediation (PRs)',
      'RBAC',
      'Email + WhatsApp support',
    ],
    selfService: true,
  },
];

/** Display names — Stripe product name is generic */
const PLAN_DISPLAY_NAMES: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
};

/** Plan-specific accent icon */
const PLAN_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  starter: Zap,
  pro: Sparkles,
  business: Shield,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChoosePlanPage() {
  const t = useTranslations('dashboard.choosePlan');
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [plans, setPlans] = useState<BackendPlan[]>(FALLBACK_PLANS);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [notAdmin, setNotAdmin] = useState(false);

  // Ensure the Core API tenant is provisioned before the user selects a plan.
  // Fire-and-forget: failures are silent — createCheckout will surface the error
  // if the tenant truly can't be created.
  useEffect(() => {
    void fetch('/api/onboarding/complete-profile', { method: 'POST', body: JSON.stringify({}) });
  }, []);

  // If user already has an active subscription (Stripe-backed, or OSS free
  // stub from Core AC-043), bounce admins to /dashboard. Non-admins see an
  // explanatory screen — only admins configure billing.
  //
  // Commercial: require hasStripeCustomer so fresh tenants with the Core
  // default status=active do not skip the plan gate.
  // OSS (AC-048): Core returns { plan: 'free', status: 'active' } with no
  // Stripe customer — treat that as active and send users to /dashboard.
  useEffect(() => {
    let cancelled = false;
    async function checkSubscription() {
      try {
        const res = await fetch('/api/billing/subscription');
        if (cancelled) return;
        // OSS subscription proxy returns 410 — skip commercial plan cards (AC-081).
        if (res.status === 410) {
          window.location.replace('/dashboard');
          return;
        }
        if (res.ok) {
          const data = await res.json();
          const sub = data.subscriptionStatus ?? data.status;
          const plan = data.plan as string | undefined;
          const hasStripeCustomer = Boolean(data.hasStripeCustomer);
          const isOssFreeActive =
            plan === 'free' && (sub === 'active' || sub === 'trialing') && !hasStripeCustomer;
          const isRealActive =
            isOssFreeActive || ((sub === 'active' || sub === 'trialing') && hasStripeCustomer);
          if (isRealActive) {
            if (isAdmin || isOssFreeActive) {
              window.location.replace('/dashboard');
            } else {
              setNotAdmin(true);
            }
            return;
          }
        }
      } catch {
        // Allow page to render on error
      }
      if (!cancelled) setReady(true);
    }
    void checkSubscription();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/plans');
      if (res.ok) {
        const data = (await res.json()) as { plans: BackendPlan[] };
        if (data.plans.length > 0) {
          setPlans(data.plans.filter((p) => p.selfService));
        }
      }
    } catch {
      // Use fallback plans
    }
  }, []);

  useEffect(() => {
    void fetchPlans();
  }, [fetchPlans]);

  async function handleSelectPlan(planKey: string) {
    setLoadingPlan(planKey);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: planKey, from: 'onboarding' }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (res.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      // OSS (AC-048): Core StubBillingService returns 410 — send the user to
      // the billing page (or dashboard) instead of trapping them here.
      if (res.status === 410 || /billing is disabled/i.test(json.error ?? '')) {
        window.location.replace('/dashboard/billing');
        return;
      }
      setError(json.error ?? t('error'));
      setLoadingPlan(null);
    } catch {
      setError(t('error'));
      setLoadingPlan(null);
    }
  }

  const handleSignOut = useCallback(() => {
    void (async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/auth/sign-in';
    })();
  }, []);

  if (notAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
        <div className="rounded-xl border border-border bg-card p-8 max-w-md space-y-4">
          <h2 className="text-xl font-bold text-foreground">{t('notAdminTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('notAdminBody')}</p>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {t('signOut')}
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-32">
        <CauseFlowLoader size="sm" />
      </div>
    );
  }

  return (
    <div className="relative space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Sign out — top right */}
      <button
        type="button"
        onClick={handleSignOut}
        className="absolute right-0 top-0 inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-card transition-colors"
        aria-label={t('signOut')}
      >
        <LogOut className="h-3.5 w-3.5" />
        {t('signOut')}
      </button>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex justify-center mb-4">
          <Image
            src="/logo.png"
            alt="CauseFlow AI"
            width={160}
            height={40}
            className="h-10 w-auto object-contain"
            priority
          />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('title')}</h1>
        <p className="text-muted-foreground text-base max-w-lg mx-auto">{t('subtitle')}</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-auto max-w-md rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center">
          {error}
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isPopular = plan.planKey === 'pro';
          const isLoading = loadingPlan === plan.planKey;
          const Icon = PLAN_ICONS[plan.planKey] ?? Zap;

          return (
            <article
              key={plan.planKey}
              className={cn(
                'relative flex flex-col rounded-2xl border p-6 transition-all duration-300',
                isPopular
                  ? 'border-success/60 bg-success/80 text-white shadow-xl shadow-emerald-500/20 scale-[1.02] ring-1 ring-emerald-500'
                  : 'border-border bg-card hover:border-primary/40 hover:shadow-lg',
              )}
            >
              {/* Popular badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-success shadow-md">
                    <Sparkles className="h-3 w-3" />
                    {t('popular')}
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="mb-4 flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg',
                    isPopular ? 'bg-white/20' : 'bg-primary/10',
                  )}
                >
                  <Icon className={cn('h-5 w-5', isPopular ? 'text-white' : 'text-primary')} />
                </div>
                <h3
                  className={cn('text-lg font-bold', isPopular ? 'text-white' : 'text-foreground')}
                >
                  {PLAN_DISPLAY_NAMES[plan.planKey] ?? plan.planKey}
                </h3>
              </div>

              {/* Price */}
              <div className="mb-1">
                <span
                  className={cn(
                    'text-4xl font-extrabold tracking-tight',
                    isPopular ? 'text-white' : 'text-foreground',
                  )}
                >
                  ${plan.priceUsd}
                </span>
                <span
                  className={cn(
                    'text-sm font-normal',
                    isPopular ? 'text-white/80' : 'text-muted-foreground',
                  )}
                >
                  {t('perMonth')}
                </span>
              </div>

              {/* Trial badge */}
              <div className="mb-5">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                    isPopular ? 'bg-white/20 text-white' : 'bg-success/10 text-success /30',
                  )}
                >
                  {t('trialBadge')}
                </span>
              </div>

              {/* Key metrics */}
              <div className="mb-5 space-y-1.5">
                <p
                  className={cn(
                    'text-sm font-semibold',
                    isPopular ? 'text-white' : 'text-foreground',
                  )}
                >
                  {t('analysesPerMonth', { count: plan.investigationsLimit })}
                </p>
                <p className={cn('text-xs', isPopular ? 'text-white/70' : 'text-muted-foreground')}>
                  {t('eventsPerMonth', { count: plan.eventsLimit.toLocaleString() })}
                </p>
              </div>

              {/* Features */}
              <ul className="mb-6 flex-1 space-y-2">
                {plan.features
                  .filter(
                    (f) =>
                      !f.includes('investigations/month') &&
                      !f.includes('events/month') &&
                      !f.includes('free trial'),
                  )
                  .map((feature) => (
                    <li
                      key={feature}
                      className={cn(
                        'flex items-start gap-2 text-sm',
                        isPopular ? 'text-white/90' : 'text-foreground',
                      )}
                    >
                      <Check
                        className={cn(
                          'mt-0.5 h-3.5 w-3.5 shrink-0',
                          isPopular ? 'text-white' : 'text-success',
                        )}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
              </ul>

              {/* CTA */}
              <button
                type="button"
                onClick={() => handleSelectPlan(plan.planKey)}
                disabled={!!loadingPlan}
                className={cn(
                  'inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  isPopular
                    ? 'bg-white text-success hover:bg-white/90 shadow-md'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('loading')}
                  </>
                ) : (
                  t('startTrial')
                )}
              </button>
            </article>
          );
        })}
      </div>

      {/* Enterprise CTA */}
      <div className="mx-auto max-w-md text-center space-y-2 rounded-xl border border-border/50 bg-card/50 p-5">
        <p className="text-sm font-semibold text-foreground">{t('enterprise')}</p>
        <p className="text-xs text-muted-foreground">{t('enterpriseDesc')}</p>
        <a
          href={`mailto:${SITE.email}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <Mail className="h-3.5 w-3.5" />
          {t('enterpriseLink')}
        </a>
      </div>

      {/* Guarantee */}
      <p className="text-center text-xs text-muted-foreground">{t('guarantee')}</p>
    </div>
  );
}

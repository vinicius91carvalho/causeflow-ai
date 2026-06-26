'use client';

import type { PlanConfig, TenantPlan } from '@causeflow/shared/constants';
import { SITE } from '@causeflow/shared/constants';
import { cn } from '@causeflow/ui/lib';
import { Check, Loader2, TrendingUp } from 'lucide-react';
import type { BillingMessages, SubscriptionData } from './billing-types';

// ---------------------------------------------------------------------------
// Plan ordering
// ---------------------------------------------------------------------------

const PLAN_ORDER: TenantPlan[] = ['starter', 'pro', 'business', 'enterprise'];

function getPlanIndex(plan: TenantPlan): number {
  return PLAN_ORDER.indexOf(plan);
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

type SubscriptionStatus = SubscriptionData['subscriptionStatus'];

function StatusBadge({
  status,
  messages,
}: {
  status: SubscriptionStatus;
  messages: BillingMessages;
}) {
  if (!status) return null;

  const configs = {
    active: {
      label: messages.statusActive,
      className: 'bg-success/10 text-success /40 border border-success/40',
    },
    canceling: {
      label: messages.statusCanceling,
      className: 'bg-warning/10 text-warning /40 border border-warning/40',
    },
    past_due: {
      label: messages.statusPastDue,
      className: 'bg-destructive/10 text-destructive /40 border border-destructive/40',
    },
    canceled: {
      label: messages.statusCanceled,
      className: 'bg-muted text-muted-foreground border border-border',
    },
  } as const;

  const config = configs[status as keyof typeof configs];
  if (!config) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export function PlanCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-border bg-card p-6 animate-pulse space-y-4"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="h-5 w-24 rounded bg-muted" />
        <div className="h-5 w-16 rounded-full bg-muted" />
      </div>
      <div className="h-8 w-20 rounded bg-muted" />
      <div className="h-3 w-28 rounded bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          <div key={i} className="flex items-center gap-2">
            <div className="h-3.5 w-3.5 rounded-full bg-muted shrink-0" />
            <div className="h-3 w-full rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="h-9 w-full rounded-lg bg-muted mt-auto" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan card
// ---------------------------------------------------------------------------

export interface PlanCardProps {
  plan: PlanConfig;
  currentPlan: TenantPlan;
  currentPlanIndex: number;
  subscription: SubscriptionData;
  messages: BillingMessages;
  onCheckout: (planId: TenantPlan) => Promise<void>;
  loadingPlanId: TenantPlan | 'portal' | null;
}

export function PlanCard({
  plan,
  currentPlan,
  currentPlanIndex,
  subscription,
  messages,
  onCheckout,
  loadingPlanId,
}: PlanCardProps) {
  const isCurrentPlan = plan.id === currentPlan;
  const planIndex = getPlanIndex(plan.id);
  const isUpgrade = planIndex > currentPlanIndex;
  const isEnterprise = plan.id === 'enterprise';
  const isHighlighted = plan.id === 'pro' && !isCurrentPlan;
  const isLoading = loadingPlanId === plan.id;

  // CTA logic
  let ctaType: 'current' | 'upgrade' | 'downgrade' | 'enterprise' = 'current';
  if (!isCurrentPlan) {
    if (isEnterprise) ctaType = 'enterprise';
    else if (isUpgrade) ctaType = 'upgrade';
    else ctaType = 'downgrade';
  }

  function handleCtaClick() {
    if (ctaType === 'enterprise') return;
    if (ctaType === 'current') return;
    void onCheckout(plan.id);
  }

  const isDisabled = ctaType === 'current' || isLoading;

  return (
    <article
      className={cn(
        'relative flex flex-col rounded-xl border p-6 transition-shadow',
        isCurrentPlan
          ? 'border-primary bg-primary/5 shadow-md'
          : isHighlighted
            ? 'border-success/60 bg-success/80 text-white shadow-lg ring-1 ring-emerald-500 hover:bg-success/80 hover:border-success/80 hover:ring-0 hover:shadow-emerald-500/20'
            : 'border-border bg-card',
      )}
      aria-label={`${plan.name} plan`}
    >
      {/* Header: name + badges */}
      <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
        <h3
          className={cn(
            'text-base font-semibold',
            isHighlighted ? 'text-white' : 'text-foreground',
          )}
        >
          {plan.name}
        </h3>
        <div className="flex flex-wrap gap-1">
          {isCurrentPlan && (
            <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              {messages.currentPlan}
            </span>
          )}
          {isHighlighted && (
            <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
              {messages.popular}
            </span>
          )}
          {isCurrentPlan && subscription.subscriptionStatus && (
            <StatusBadge status={subscription.subscriptionStatus} messages={messages} />
          )}
        </div>
      </div>

      {/* Price */}
      <div className="mb-4">
        {isEnterprise ? (
          <p className={cn('text-2xl font-bold', isHighlighted ? 'text-white' : 'text-foreground')}>
            {messages.custom}
          </p>
        ) : (
          <p className={cn('text-2xl font-bold', isHighlighted ? 'text-white' : 'text-foreground')}>
            {`$${plan.price}`}
            {
              <span
                className={cn(
                  'text-sm font-normal',
                  isHighlighted ? 'text-white/80' : 'text-muted-foreground',
                )}
              >
                {messages.perMonth}
              </span>
            }
          </p>
        )}
        <p
          className={cn(
            'mt-0.5 text-xs',
            isHighlighted ? 'text-white/80' : 'text-muted-foreground',
          )}
        >
          {isEnterprise
            ? messages.creditsUnlimited
            : messages.creditsPerMonth.replace('0', String(plan.credits))}
        </p>
        {!isEnterprise && plan.overagePerCredit > 0 && (
          <p
            className={cn(
              'mt-0.5 text-xs',
              isHighlighted ? 'text-white/60' : 'text-muted-foreground/70',
            )}
          >
            {messages.overageNote.replace('{amount}', String(plan.overagePerCredit))}
          </p>
        )}
      </div>

      {/* Features */}
      <ul className="mb-6 flex-1 space-y-2" aria-label={`${plan.name} features`}>
        {plan.features.map((feature) => (
          <li
            key={feature}
            className={cn(
              'flex items-start gap-2 text-sm',
              isHighlighted ? 'text-white/90' : 'text-foreground',
            )}
          >
            <Check
              className={cn(
                'mt-0.5 h-3.5 w-3.5 shrink-0',
                isHighlighted ? 'text-white' : 'text-primary',
              )}
              aria-hidden="true"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {ctaType === 'current' ? (
        <div className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary">
          <Check className="h-4 w-4" aria-hidden="true" />
          {messages.currentPlan}
        </div>
      ) : ctaType === 'enterprise' ? (
        <a
          href={`mailto:${SITE.email}`}
          className={cn(
            'inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
        >
          <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
          {messages.contactSales}
        </a>
      ) : (
        <button
          type="button"
          onClick={handleCtaClick}
          disabled={isDisabled}
          className={cn(
            'inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-60',
            isHighlighted
              ? 'border border-white bg-white text-success hover:bg-white/90 hover:text-success disabled:hover:bg-white disabled:hover:text-success'
              : ctaType === 'upgrade'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : ctaType === 'upgrade' ? (
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : null}
          {isLoading
            ? messages.loading
            : ctaType === 'upgrade'
              ? messages.upgrade
              : messages.downgrade}
        </button>
      )}
    </article>
  );
}

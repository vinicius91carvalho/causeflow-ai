'use client';

import { PLANS } from '@causeflow/shared/constants';
import { AnimateOnScroll } from '@causeflow/ui/themes';
import { useState } from 'react';
import { getDashboardUrl } from '@/lib/dashboard-url';
import { PricingCard } from './pricing-card';
import { ROICalculator } from './roi-calculator';

const PLAN_INCIDENT_MAP: Record<string, number> = Object.fromEntries(
  Object.values(PLANS).map((p) => [p.name, p.credits === -1 ? 100 : p.credits]),
);

export interface PricingPlanRenderData {
  id: string;
  name: string;
  displayName: string;
  priceDisplay: string;
  annualPriceDisplay?: string;
  period?: string;
  annualPeriod?: string;
  description: string;
  rateLimit?: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
  badge?: string;
}

interface PricingInteractiveProps {
  plans: PricingPlanRenderData[];
  roiLabels?: {
    title?: string;
    incidents?: string;
    time?: string;
    engineers?: string;
    hoursSaved?: string;
    causeflowCost?: string;
    perSeatCost?: string;
    platformCost?: string;
    annualSavings?: string;
  };
  roiTitle?: string;
  billingLabels?: {
    monthly?: string;
    annual?: string;
    annualDiscount?: string;
  };
  overageLabels?: {
    title?: string;
    subtitle?: string;
    investigationRate?: string;
    investigationLabel?: string;
    eventRate?: string;
    eventLabel?: string;
    or?: string;
    pack1Name?: string;
    pack1Price?: string;
    pack1Unit?: string;
    pack2Name?: string;
    pack2Price?: string;
    pack2Unit?: string;
  };
}

export function PricingInteractive({
  plans,
  roiLabels,
  roiTitle,
  billingLabels,
  overageLabels,
}: PricingInteractiveProps) {
  const [selectedPlanName, setSelectedPlanName] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const dashboardUrl = getDashboardUrl();

  const selectedIncidents =
    selectedPlanName != null ? (PLAN_INCIDENT_MAP[selectedPlanName] ?? 50) : undefined;

  function handleSelectPlan(planName: string) {
    setSelectedPlanName(planName);
    const el = document.getElementById('roi-calculator');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <>
      {/* Billing toggle */}
      <div className="mb-8 flex items-center justify-center gap-3">
        <span
          className={`text-sm font-medium transition-colors ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          {billingLabels?.monthly ?? 'Monthly'}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isAnnual}
          onClick={() => setIsAnnual(!isAnnual)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${isAnnual ? 'bg-primary' : 'bg-muted'}`}
        >
          <span
            className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${isAnnual ? 'translate-x-5' : 'translate-x-0'}`}
          />
        </button>
        <span
          className={`text-sm font-medium transition-colors ${isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          {billingLabels?.annual ?? 'Annual'}
        </span>
        {isAnnual && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            {billingLabels?.annualDiscount ?? '15% off'}
          </span>
        )}
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan, index) => (
          <AnimateOnScroll key={plan.id} delay={index * 100}>
            <PricingCard
              name={plan.displayName}
              price={
                isAnnual && plan.annualPriceDisplay ? plan.annualPriceDisplay : plan.priceDisplay
              }
              period={isAnnual && plan.annualPeriod ? plan.annualPeriod : plan.period}
              description={plan.description}
              rateLimit={plan.rateLimit}
              features={plan.features}
              cta={plan.cta}
              highlighted={plan.highlighted}
              badge={plan.badge}
              selected={selectedPlanName === plan.name}
              onSelect={() => handleSelectPlan(plan.name)}
              onCtaClick={
                plan.name === 'Enterprise'
                  ? () => {
                      window.open(dashboardUrl, '_blank', 'noopener,noreferrer');
                    }
                  : undefined
              }
            />
          </AnimateOnScroll>
        ))}
      </div>

      {/* Overage / Quota Info */}
      {overageLabels?.title && (
        <div className="mx-auto mt-12 max-w-2xl text-center">
          <h3 className="text-lg font-semibold">{overageLabels.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{overageLabels.subtitle}</p>
        </div>
      )}

      {/* ROI Calculator — anchored section */}
      <div id="roi-calculator" className="mx-auto mt-16 max-w-4xl scroll-mt-20">
        {roiTitle && (
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              {roiTitle}
            </h2>
          </div>
        )}
        <ROICalculator labels={roiLabels} initialIncidents={selectedIncidents} />
      </div>
    </>
  );
}

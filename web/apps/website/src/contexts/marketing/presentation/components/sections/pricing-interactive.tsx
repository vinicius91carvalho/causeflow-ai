'use client';

import { PLANS } from '@causeflow/shared/constants';
import { AnimateOnScroll } from '@causeflow/ui/themes';
import { useState } from 'react';
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
  cta: { label: string; href: string; external?: boolean };
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

export function PricingInteractive({ plans, roiLabels, roiTitle }: PricingInteractiveProps) {
  const [selectedPlanName, setSelectedPlanName] = useState<string | null>(null);

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
      {/* Plans grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan, index) => (
          <AnimateOnScroll key={plan.id} delay={index * 100}>
            <PricingCard
              name={plan.displayName}
              price={plan.priceDisplay}
              period={plan.period}
              description={plan.description}
              rateLimit={plan.rateLimit}
              features={plan.features}
              cta={plan.cta}
              highlighted={plan.highlighted}
              badge={plan.badge}
              selected={selectedPlanName === plan.name}
              onSelect={() => handleSelectPlan(plan.name)}
            />
          </AnimateOnScroll>
        ))}
      </div>

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

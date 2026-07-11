import type { SubscriptionStatus } from '../types';

export type { SubscriptionStatus };

export type TenantPlan = 'starter' | 'pro' | 'business' | 'enterprise';

/** Free-tier monthly investigation quota (not a self-service checkout plan). */
export const FREE_PLAN_MONTHLY_CREDITS = 3;

export interface PlanConfig {
  id: TenantPlan;
  name: string;
  price: number; // monthly USD, -1 for custom
  credits: number; // monthly credits, -1 for unlimited
  overagePerCredit: number; // overage cost, 0 if N/A
  selfService: boolean; // can subscribe via Checkout
  stripePriceEnvVar: string | null; // env var name for Stripe price ID, null for Free/Enterprise
  features: string[];
}

export const PLANS: Record<TenantPlan, PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 99,
    credits: 15,
    overagePerCredit: 8.99,
    selfService: true,
    stripePriceEnvVar: 'STRIPE_PRICE_STARTER',
    features: [
      '15 investigations/month',
      'All integrations',
      'Audit trail',
      'Knowledge Base',
      'Remediation (PRs)',
      'RBAC',
      'Email support',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 349,
    credits: 60,
    overagePerCredit: 8.99,
    selfService: true,
    stripePriceEnvVar: 'STRIPE_PRICE_PRO',
    features: [
      '60 investigations/month',
      'All integrations',
      'Audit trail',
      'Knowledge Base',
      'Remediation (PRs)',
      'RBAC',
      'Email + WhatsApp support',
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 899,
    credits: 200,
    overagePerCredit: 8.99,
    selfService: true,
    stripePriceEnvVar: 'STRIPE_PRICE_BUSINESS',
    features: [
      '200 investigations/month',
      'All integrations',
      'Audit trail',
      'Knowledge Base',
      'Remediation (PRs)',
      'RBAC',
      'Email + WhatsApp support',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: -1,
    credits: -1,
    overagePerCredit: 0,
    selfService: false,
    stripePriceEnvVar: null,
    features: [
      'Unlimited investigations',
      'All + custom integrations',
      'Audit trail',
      'Knowledge Base',
      'Remediation (PRs)',
      'RBAC + SSO/SAML',
      'Email + WhatsApp + Dedicated support + SLA',
    ],
  },
};

export function getPlanByStripePriceId(priceId: string): PlanConfig | undefined {
  return Object.values(PLANS).find((plan) => {
    if (!plan.stripePriceEnvVar) return false;
    return process.env[plan.stripePriceEnvVar] === priceId;
  });
}

export function getCreditsForPlan(plan: TenantPlan): number {
  return PLANS[plan].credits;
}

export function getFreePlanMonthlyCredits(): number {
  return FREE_PLAN_MONTHLY_CREDITS;
}

export function getSelfServicePlans(): PlanConfig[] {
  return Object.values(PLANS).filter((plan) => plan.selfService);
}

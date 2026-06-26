/**
 * Marketing domain types
 * Pricing plan types, feature list types, and other marketing domain models.
 */

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  features: string[];
  highlighted?: boolean;
  ctaLabel: string;
  ctaHref: string;
}

export interface FeatureItem {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export interface SecurityCommitment {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

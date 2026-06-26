export type Locale = 'en' | 'pt-br';

export type SubscriptionStatus = 'active' | 'canceling' | 'past_due' | 'canceled';

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

export interface Integration {
  id: string;
  name: string;
  category:
    | 'communication'
    | 'code'
    | 'monitoring'
    | 'management'
    | 'crm'
    | 'database'
    | 'knowledge'
    | 'api'
    | 'cloud'
    | 'ci-cd';
  description: string;
  differentiator?: string;
  icon?: string;
  agentConnection?: string;
  featured?: boolean;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: number | string;
  annualPrice?: number | string;
  investigations: string;
  events: string;
  rateLimit: string;
  overage?: string;
  eventOverage?: string;
  target: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

export interface SecurityCommitment {
  title: string;
  description: string;
  technicalDetail?: string;
}

export interface TeamMember {
  role: string;
  background: string;
  responsibility: string;
  image?: string;
}

export interface RoadmapItem {
  period: string;
  product: string;
  business: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface MetricItem {
  label: string;
  value: string;
  description: string;
}

export interface StepItem {
  number: number;
  title: string;
  description: string;
  icon?: string;
}

export interface UsageMode {
  id: string;
  title: string;
  description: string;
  icon?: string;
}

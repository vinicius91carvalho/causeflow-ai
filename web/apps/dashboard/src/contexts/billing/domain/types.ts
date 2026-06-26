/**
 * Billing domain types.
 */

export type TenantPlan = 'starter' | 'pro' | 'business' | 'enterprise';

export type SubscriptionStatus = 'active' | 'trialing' | 'canceling' | 'past_due' | 'canceled';

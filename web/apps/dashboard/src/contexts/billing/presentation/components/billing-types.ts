import type { TenantPlan } from '@causeflow/shared/constants';
import type { SubscriptionStatus as BaseSubscriptionStatus } from '../../domain/types';

export type SubscriptionStatus = BaseSubscriptionStatus | null;

export interface SubscriptionData {
  plan: TenantPlan;
  subscriptionStatus: SubscriptionStatus;
  creditsTotal: number;
  creditsUsed: number;
  creditsRemaining: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
}

export interface BillingMessages {
  title: string;
  description: string;
  currentPlan: string;
  upgrade: string;
  downgrade: string;
  downgradeToFree: string;
  contactSales: string;
  manageSubscription: string;
  creditsPerMonth: string;
  creditsUnlimited: string;
  perMonth: string;
  custom: string;
  renewsOn: string;
  cancelsOn: string;
  creditsUsed: string;
  upgradeMailSubject: string;
  upgradeMailBody: string;
  statusActive: string;
  statusCanceling: string;
  statusPastDue: string;
  statusCanceled: string;
  statusCancelingMessage: string;
  statusPastDueMessage: string;
  popular: string;
  overageNote: string;
  checkoutError: string;
  portalError: string;
  purchaseError: string;
  purchaseSuccess: string;
  loading: string;
  usageHistory: string;
  investigationsUsed: string;
  eventsProcessed: string;
  used: string;
  of: string;
  last30Days: string;
  buyMore: string;
  quotaPacks: string;
  quotaPackInvestigations: string;
  quotaPackEvents: string;
  quotaPackInvestigationsDesc: string;
  quotaPackEventsDesc: string;
  purchase: string;
  purchasing: string;
  invoices: string;
  invoiceDate: string;
  invoiceAmount: string;
  invoiceStatus: string;
  invoiceDownload: string;
  invoicePaid: string;
  invoiceOpen: string;
  invoiceDraft: string;
  invoiceVoid: string;
  invoiceUncollectible: string;
  noInvoices: string;
}

export interface UsageHistoryData {
  investigations: { used: number; limit: number };
  events: { used: number; limit: number };
  daily: Array<{ date: string; investigations: number; events: number }>;
}

export interface InvoiceData {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'draft' | 'void' | 'uncollectible';
  pdfUrl: string | null;
}

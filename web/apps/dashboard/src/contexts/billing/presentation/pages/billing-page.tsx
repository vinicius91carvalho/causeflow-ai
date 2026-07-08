import { PageHeader } from '@causeflow/ui/layouts';
import type { Metadata } from 'next';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { BillingPage } from '@/contexts/billing/presentation/components/billing-content';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard.billing' });
  return { title: t('title') };
}

export default async function BillingRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'dashboard.billing' });
  const allMessages = await getMessages({ locale });

  // Raw billing messages — used for template strings that the client component
  // substitutes at render time (e.g. renewsOn, statusCancelingMessage).
  // We cannot use t() with ICU params here because next-intl would eagerly
  // replace the {date} placeholder with the empty string we pass, leaving
  // no placeholder for the client component to substitute later.
  const billingRaw = (allMessages as Record<string, unknown>).dashboard as Record<
    string,
    Record<string, string>
  >;
  const rawBilling = billingRaw.billing ?? {};

  const messages = {
    title: t('title'),
    description: t('description'),
    currentPlan: t('currentPlan'),
    upgrade: t('upgrade'),
    downgrade: t('downgrade'),
    downgradeToFree: t('downgradeToFree'),
    contactSales: t('contactSales'),
    manageSubscription: t('manageSubscription'),
    creditsPerMonth: t('creditsPerMonth', { count: 0 }),
    creditsUnlimited: t('creditsUnlimited'),
    perMonth: t('perMonth'),
    custom: t('custom'),
    // Pass raw template strings — the client component substitutes {date} itself
    renewsOn: rawBilling.renewsOn ?? 'Renews on {date}',
    cancelsOn: rawBilling.cancelsOn ?? 'Cancels on {date}',
    creditsUsed: rawBilling.creditsUsed ?? '{used} / {total} credits used',
    upgradeMailSubject: rawBilling.upgradeMailSubject ?? 'Upgrade to {plan}',
    upgradeMailBody: rawBilling.upgradeMailBody ?? '',
    statusActive: t('statusActive'),
    statusCanceling: t('statusCanceling'),
    statusPastDue: t('statusPastDue'),
    statusCanceled: t('statusCanceled'),
    // Pass raw template string — the client component substitutes {date} itself
    statusCancelingMessage:
      rawBilling.statusCancelingMessage ??
      'Your subscription will end on {date}. You can reactivate anytime.',
    statusPastDueMessage: t('statusPastDueMessage'),
    popular: t('popular'),
    overageNote: rawBilling.overageNote ?? `+${amount}/extra investigation`,
    checkoutError: t('checkoutError'),
    portalError: t('portalError'),
    purchaseError: t('purchaseError'),
    purchaseSuccess: t('purchaseSuccess'),
    loading: t('loading'),
    usageHistory: t('usageHistory'),
    investigationsUsed: t('investigationsUsed'),
    eventsProcessed: t('eventsProcessed'),
    used: t('used'),
    of: t('of'),
    last30Days: t('last30Days'),
    buyMore: t('buyMore'),
    quotaPacks: t('quotaPacks'),
    quotaPackInvestigations: t('quotaPackInvestigations'),
    quotaPackEvents: t('quotaPackEvents'),
    quotaPackInvestigationsDesc: t('quotaPackInvestigationsDesc'),
    quotaPackEventsDesc: t('quotaPackEventsDesc'),
    purchase: t('purchase'),
    purchasing: t('purchasing'),
    invoices: t('invoices'),
    invoiceDate: t('invoiceDate'),
    invoiceAmount: t('invoiceAmount'),
    invoiceStatus: t('invoiceStatus'),
    invoiceDownload: t('invoiceDownload'),
    invoicePaid: t('invoicePaid'),
    invoiceOpen: t('invoiceOpen'),
    invoiceDraft: t('invoiceDraft'),
    invoiceVoid: t('invoiceVoid'),
    invoiceUncollectible: t('invoiceUncollectible'),
    noInvoices: t('noInvoices'),
  } as const;

  return (
    <div className="space-y-6">
      <PageHeader title={messages.title} description={messages.description} />
      <BillingPage messages={messages} />
    </div>
  );
}

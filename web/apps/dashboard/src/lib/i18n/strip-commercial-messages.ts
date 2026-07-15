/**
 * Strip commercial billing / plan-selection copy from next-intl messages (AC-083).
 *
 * OSS builds must not embed paid-plan selection, upgrade, or checkout strings in
 * RSC / Flight payloads via NextIntlClientProvider. Client-side JSX gating alone
 * is insufficient — the full compose.ts tree is still serialized on every page.
 */

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

function isObject(value: JsonValue | undefined): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function deletePath(root: JsonObject, path: string[]): void {
  let cursor: JsonObject = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    if (key === undefined) return;
    const next = cursor[key];
    if (!isObject(next)) return;
    cursor = next;
  }
  const leaf = path[path.length - 1];
  if (leaf !== undefined) {
    delete cursor[leaf];
  }
}

/** Commercial keys removed from the dashboard message tree in OSS runtimes. */
export const OSS_COMMERCIAL_MESSAGE_PATHS: readonly string[][] = [
  ['dashboard', 'choosePlan'],
  ['dashboard', 'onboarding', 'steps', 'billing'],
  ['dashboard', 'settings', 'company', 'upgradePlan'],
  ['dashboard', 'settings', 'company', 'plan'],
  ['dashboard', 'home', 'credits', 'upgrade'],
  // Shared product tour (key is `tour`, not overviewTour)
  ['dashboard', 'tour', 'billing'],
  ['dashboard', 'tour', 'billingDesc'],
  // dashboard.billing — paid-plan / checkout / upgrade CTAs and plan-card labels
  ['dashboard', 'billing', 'upgrade'],
  ['dashboard', 'billing', 'downgrade'],
  ['dashboard', 'billing', 'downgradeToFree'],
  ['dashboard', 'billing', 'manageSubscription'],
  ['dashboard', 'billing', 'manageBillingInStripe'],
  ['dashboard', 'billing', 'upgradeMailSubject'],
  ['dashboard', 'billing', 'upgradeMailBody'],
  ['dashboard', 'billing', 'planStarter'],
  ['dashboard', 'billing', 'planPro'],
  ['dashboard', 'billing', 'planBusiness'],
  ['dashboard', 'billing', 'planEnterprise'],
  ['dashboard', 'billing', 'checkoutError'],
  ['dashboard', 'billing', 'portalError'],
  ['dashboard', 'billing', 'purchaseError'],
  ['dashboard', 'billing', 'purchaseSuccess'],
  ['dashboard', 'billing', 'buyMore'],
  ['dashboard', 'billing', 'quotaPacks'],
  ['dashboard', 'billing', 'quotaPackInvestigations'],
  ['dashboard', 'billing', 'quotaPackEvents'],
  ['dashboard', 'billing', 'quotaPackInvestigationsDesc'],
  ['dashboard', 'billing', 'quotaPackEventsDesc'],
  ['dashboard', 'billing', 'purchase'],
  ['dashboard', 'billing', 'purchasing'],
  ['dashboard', 'billing', 'invoices'],
  ['dashboard', 'billing', 'invoiceDate'],
  ['dashboard', 'billing', 'invoiceAmount'],
  ['dashboard', 'billing', 'invoiceStatus'],
  ['dashboard', 'billing', 'invoiceDownload'],
  ['dashboard', 'billing', 'invoicePaid'],
  ['dashboard', 'billing', 'invoiceOpen'],
  ['dashboard', 'billing', 'invoiceDraft'],
  ['dashboard', 'billing', 'invoiceVoid'],
  ['dashboard', 'billing', 'invoiceUncollectible'],
  ['dashboard', 'billing', 'noInvoices'],
];

/**
 * Returns a deep-cloned message tree with commercial plan/billing copy removed.
 * Does not mutate the input (compose.ts singletons stay intact for commercial).
 */
export function stripCommercialMessages<T>(messages: T): T {
  const clone = structuredClone(messages) as JsonObject;
  for (const path of OSS_COMMERCIAL_MESSAGE_PATHS) {
    deletePath(clone, path);
  }
  return clone as T;
}

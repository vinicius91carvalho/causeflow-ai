import { FREE_PLAN_MONTHLY_CREDITS } from '@causeflow/shared';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface SubscriptionCreditsInput {
  plan?: string;
  status?: string;
  investigationsLimit?: number;
  investigationsUsed?: number;
  currentPeriodEnd?: string | null;
  renewDate?: string | null;
}

export interface CreditsSnapshot {
  creditsTotal: number;
  creditsUsed: number;
  creditsRemaining: number;
  renewDate: string | null;
  plan: string;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
}

interface LedgerEntry {
  creditsUsed: number;
  renewDate: string;
}

const ledger = new Map<string, LedgerEntry>();

function defaultRenewDate(): string {
  return new Date(Date.now() + THIRTY_DAYS_MS).toISOString();
}

function isUnlimitedCredits(total: number): boolean {
  return total < 0;
}

/**
 * Free tenants without a Stripe-managed period use the dashboard's local ledger.
 * Paid tenants (and canceling tenants still inside currentPeriodEnd) use Core quotas.
 */
export function usesLocalFreeLedger(sub: SubscriptionCreditsInput): boolean {
  const plan = sub.plan ?? 'free';
  if (plan !== 'free') return false;
  return !sub.currentPeriodEnd;
}

export function resolveCredits(
  tenantId: string,
  sub: SubscriptionCreditsInput,
  options?: { renew?: boolean },
): CreditsSnapshot {
  if (!usesLocalFreeLedger(sub)) {
    const total = sub.investigationsLimit ?? 0;
    const used = sub.investigationsUsed ?? 0;
    const remaining = isUnlimitedCredits(total)
      ? Number.POSITIVE_INFINITY
      : Math.max(0, total - used);
    return {
      creditsTotal: total,
      creditsUsed: used,
      creditsRemaining: remaining,
      renewDate: sub.renewDate ?? null,
      plan: sub.plan ?? 'free',
      subscriptionStatus: sub.status ?? null,
      currentPeriodEnd: sub.currentPeriodEnd ?? null,
    };
  }

  let entry = ledger.get(tenantId);
  if (!entry) {
    entry = { creditsUsed: 0, renewDate: defaultRenewDate() };
    ledger.set(tenantId, entry);
  }

  if (options?.renew && Date.parse(entry.renewDate) <= Date.now()) {
    entry = { creditsUsed: 0, renewDate: defaultRenewDate() };
    ledger.set(tenantId, entry);
  }

  const creditsRemaining = Math.max(0, FREE_PLAN_MONTHLY_CREDITS - entry.creditsUsed);
  return {
    creditsTotal: FREE_PLAN_MONTHLY_CREDITS,
    creditsUsed: entry.creditsUsed,
    creditsRemaining,
    renewDate: entry.renewDate,
    plan: 'free',
    subscriptionStatus: sub.status ?? 'active',
    currentPeriodEnd: null,
  };
}

export function consumeCredit(
  tenantId: string,
  sub: SubscriptionCreditsInput,
): { ok: true } | { ok: false; code: 'CREDITS_EXHAUSTED' } {
  const snapshot = resolveCredits(tenantId, sub, { renew: true });
  if (!Number.isFinite(snapshot.creditsRemaining) || snapshot.creditsRemaining <= 0) {
    return { ok: false, code: 'CREDITS_EXHAUSTED' };
  }

  if (usesLocalFreeLedger(sub)) {
    const entry = ledger.get(tenantId) ?? { creditsUsed: 0, renewDate: defaultRenewDate() };
    entry.creditsUsed += 1;
    ledger.set(tenantId, entry);
  }

  return { ok: true };
}

/** Test-only reset — not exported for production routes. */
export function _resetCreditsLedgerForTests(): void {
  ledger.clear();
}

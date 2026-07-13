'use client';

/**
 * OSS builds: credits quota banner is removed (AC-074 / PD-OSS-BILLING-PURGE).
 * Component retained as a no-op so stale imports never render remaining-credit limits.
 */

interface CreditsBannerProps {
  creditsTotal?: number;
  creditsUsed?: number;
  creditsRemaining?: number;
  renewDate?: string;
  upgradeLabel?: string;
  renewsLabel?: string;
  creditsRemainingLabel?: string;
  warningLabel?: string;
  criticalLabel?: string;
  loading?: boolean;
}

export function CreditsBanner(_props: CreditsBannerProps) {
  return null;
}

export function CreditsBannerSkeleton() {
  return null;
}

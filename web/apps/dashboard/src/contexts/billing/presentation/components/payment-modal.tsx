'use client';

import type { TenantPlan } from '@causeflow/shared/constants';
import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Modal wrapper — OSS stub (AC-048)
// ---------------------------------------------------------------------------
// Stripe React SDK removed. This modal posts to the dashboard checkout proxy,
// which forwards to Core's StubBillingService (410 Gone) and shows a clear
// "Billing disabled in OSS build" panel. No card iframe / stripe.com traffic.

interface PaymentModalProps {
  open: boolean;
  /** Unused in OSS — kept for call-site compatibility with billing-content. */
  clientSecret: string | null;
  planName: string;
  planId: TenantPlan;
  isTrialing: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export function PaymentModal({
  open,
  clientSecret: _clientSecret,
  planName,
  planId,
  isTrialing: _isTrialing,
  onClose,
  onSuccess: _onSuccess,
  onError,
}: PaymentModalProps) {
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const postCheckout = useCallback(async () => {
    setPosting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, from: 'billing' }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (res.status === 410 || /billing is disabled/i.test(json.error ?? '')) {
        setMessage('Billing disabled in OSS build');
        return;
      }
      if (res.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      const err = json.error ?? 'Failed to create checkout session';
      setMessage(err);
      onError(err);
    } catch {
      const err = 'Failed to create checkout session';
      setMessage(err);
      onError(err);
    } finally {
      setPosting(false);
    }
  }, [planId, onError]);

  useEffect(() => {
    if (!open) {
      setMessage(null);
      setPosting(false);
      return;
    }
    void postCheckout();
  }, [open, postCheckout]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl bg-card p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            role="img"
          >
            <title>Close</title>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="mb-1 text-lg font-semibold text-foreground">Subscribe to {planName}</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Open-source builds do not process payments through Stripe.
        </p>

        <div
          className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground"
          data-testid="billing-disabled-panel"
        >
          {posting && !message ? (
            <p>Checking billing availability…</p>
          ) : (
            <p className="font-medium">{message ?? 'Billing disabled in OSS build'}</p>
          )}
          <p className="mt-2 text-muted-foreground">
            Billing is disabled in the OSS build. Checkout is not available.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          Close
        </button>
      </div>
    </div>
  );
}

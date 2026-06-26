'use client';

import type { TenantPlan } from '@causeflow/shared/constants';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useCallback, useState } from 'react';

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

// ---------------------------------------------------------------------------
// Payment Form (inside Elements provider)
// ---------------------------------------------------------------------------

interface PaymentFormProps {
  onSuccess: () => void;
  onError: (msg: string) => void;
  isTrialing: boolean;
}

function PaymentForm({ onSuccess, onError, isTrialing }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!stripe || !elements) return;

      setProcessing(true);

      try {
        const confirmFn = isTrialing ? stripe.confirmSetup : stripe.confirmPayment;
        const { error } = await confirmFn({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/dashboard/billing?success=1`,
          },
        });

        if (error) {
          onError(error.message ?? 'Payment failed');
          setProcessing(false);
        } else {
          onSuccess();
        }
      } catch {
        onError('An unexpected error occurred');
        setProcessing(false);
      }
    },
    [stripe, elements, isTrialing, onSuccess, onError],
  );

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />
      <button
        type="submit"
        disabled={!stripe || !elements || processing}
        className="w-full rounded-md bg-success/80 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-success/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {processing ? 'Processing...' : isTrialing ? 'Start free trial' : 'Subscribe'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Modal wrapper
// ---------------------------------------------------------------------------

interface PaymentModalProps {
  open: boolean;
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
  clientSecret,
  planName,
  planId: _planId,
  isTrialing,
  onClose,
  onSuccess,
  onError,
}: PaymentModalProps) {
  if (!open || !clientSecret || !stripePromise) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl bg-card p-6 shadow-2xl ">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground"
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

        {/* Header */}
        <h2 className="mb-1 text-lg font-semibold text-muted-foreground dark:text-white">
          Subscribe to {planName}
        </h2>
        <p className="mb-6 text-sm text-muted-foreground ">
          {isTrialing
            ? "Start your 7-day free trial. You won't be charged today."
            : 'Enter your payment details to subscribe.'}
        </p>

        {/* Stripe Payment Element */}
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: 'hsl(232, 50%, 18%)', // cleric DS primary token (light mode)
                borderRadius: '8px',
              },
            },
          }}
        >
          <PaymentForm onSuccess={onSuccess} onError={onError} isTrialing={isTrialing} />
        </Elements>
      </div>
    </div>
  );
}

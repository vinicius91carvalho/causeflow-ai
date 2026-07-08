'use client';

import { cn } from '@causeflow/ui/lib';
import { Loader2, Package, X } from 'lucide-react';
import { useState } from 'react';
import type { BillingMessages } from './billing-types';

// ---------------------------------------------------------------------------
// Quota pack definitions
// ---------------------------------------------------------------------------

interface QuotaPack {
  packType: 'investigations' | 'events';
  quantity: number;
  price: number;
  label: string;
  description: string;
}

function getQuotaPacks(messages: BillingMessages): QuotaPack[] {
  return [
    {
      packType: 'investigations',
      quantity: 10,
      price: 79,
      label: messages.quotaPackInvestigations,
      description: messages.quotaPackInvestigationsDesc,
    },
    {
      packType: 'events',
      quantity: 1000,
      price: 99,
      label: messages.quotaPackEvents,
      description: messages.quotaPackEventsDesc,
    },
  ];
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function QuotaPackModal({
  open,
  onClose,
  messages,
  onSuccess,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  messages: BillingMessages;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const packs = getQuotaPacks(messages);

  if (!open) return null;

  async function handlePurchase(pack: QuotaPack) {
    setPurchasing(pack.packType);
    try {
      const res = await fetch('/api/billing/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packType: pack.packType, quantity: pack.quantity }),
      });
      const json = (await res.json()) as { error?: string; url?: string };
      if (res.ok) {
        if (json.url) {
          // If the backend returns a checkout URL, redirect
          window.location.href = json.url;
        } else {
          onSuccess(messages.purchaseSuccess);
          onClose();
        }
      } else {
        onError(json.error ?? messages.purchaseError);
      }
    } catch {
      onError(messages.purchaseError);
    } finally {
      setPurchasing(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={messages.quotaPacks}
    >
      {/* Backdrop */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop div — closes modal on click outside */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        role="presentation"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" aria-hidden="true" />
            {messages.quotaPacks}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {packs.map((pack) => (
            <div
              key={pack.packType}
              className="flex items-center justify-between rounded-lg border border-border p-4 hover:border-primary/30 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{pack.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{pack.description}</p>
              </div>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className="text-sm font-semibold text-foreground">${pack.price}</span>
                <button
                  type="button"
                  onClick={() => void handlePurchase(pack)}
                  disabled={purchasing !== null}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
                    'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                >
                  {purchasing === pack.packType ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      {messages.purchasing}
                    </>
                  ) : (
                    messages.purchase
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

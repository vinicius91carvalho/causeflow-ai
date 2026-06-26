'use client';

import { cn } from '@causeflow/ui/lib';
import { Download, FileText, Receipt } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { BillingMessages, InvoiceData } from './billing-types';

// ---------------------------------------------------------------------------
// Invoices skeleton
// ---------------------------------------------------------------------------

export function InvoicesSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 animate-pulse" aria-hidden="true">
      <div className="h-5 w-20 rounded bg-muted mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-12 rounded bg-muted" />
            <div className="h-4 w-8 rounded bg-muted ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({
  status,
  messages,
}: {
  status: InvoiceData['status'];
  messages: BillingMessages;
}) {
  const statusLabels: Record<InvoiceData['status'], string> = {
    paid: messages.invoicePaid,
    open: messages.invoiceOpen,
    draft: messages.invoiceDraft,
    void: messages.invoiceVoid,
    uncollectible: messages.invoiceUncollectible,
  };

  const statusStyles: Record<InvoiceData['status'], string> = {
    paid: 'bg-success/10 text-success /30',
    open: 'bg-primary/10 text-primary /30',
    draft: 'bg-muted text-muted-foreground ',
    void: 'bg-muted text-muted-foreground ',
    uncollectible: 'bg-destructive/10 text-destructive /30',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        statusStyles[status],
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Invoices table
// ---------------------------------------------------------------------------

export function InvoicesTable({ messages }: { messages: BillingMessages }) {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchInvoices() {
      try {
        const res = await fetch('/api/billing/invoices?limit=10');
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { invoices: InvoiceData[] };
          setInvoices(data.invoices ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchInvoices();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <InvoicesSkeleton />;

  return (
    <section className="rounded-lg border border-border bg-card p-6" aria-label={messages.invoices}>
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
        <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {messages.invoices}
      </h2>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mb-2 opacity-40" aria-hidden="true" />
          <p className="text-sm">{messages.noInvoices}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-4 font-medium text-muted-foreground">
                  {messages.invoiceDate}
                </th>
                <th className="pb-2 pr-4 font-medium text-muted-foreground">
                  {messages.invoiceAmount}
                </th>
                <th className="pb-2 pr-4 font-medium text-muted-foreground">
                  {messages.invoiceStatus}
                </th>
                <th className="pb-2 font-medium text-muted-foreground text-right">
                  {messages.invoiceDownload}
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-border/50 last:border-0">
                  <td className="py-3 pr-4 text-foreground">
                    {new Date(invoice.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-3 pr-4 text-foreground font-medium">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: invoice.currency ?? 'usd',
                    }).format(invoice.amount / 100)}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={invoice.status} messages={messages} />
                  </td>
                  <td className="py-3 text-right">
                    {invoice.pdfUrl ? (
                      <a
                        href={invoice.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                        aria-label={`${messages.invoiceDownload} PDF`}
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        PDF
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

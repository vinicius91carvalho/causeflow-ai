'use client';

import { useState } from 'react';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';

/**
 * AD-7: "Fire Test Error" button — success contract.
 *
 * The Core API intentionally returns HTTP 500 + { error: 'TestErrorFired', traceId }
 * to confirm the error was fired and captured. The dashboard treats this as SUCCESS.
 * Any other status / error body = real failure.
 */
export function FireTestErrorsCard() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [lastFiredTraceId, setLastFiredTraceId] = useState<string | null>(null);

  async function handleFire() {
    setLoading(true);
    setLastFiredTraceId(null);
    try {
      const res = await fetch('/api/admin/fire-test-errors', { method: 'POST' });
      const body = (await res.json()) as { error?: string; traceId?: string };

      // AD-7: HTTP 500 + TestErrorFired body = intentional success signal from Core API
      if (res.status >= 500 && body.error === 'TestErrorFired') {
        const traceId = body.traceId ?? 'unknown';
        setLastFiredTraceId(traceId);
        addToast(`Test error fired — Sentry captured it (traceId: ${traceId})`, 'success');
        return;
      }

      // Any other failure (network error, auth error, unexpected server error)
      if (!res.ok) {
        addToast(body.error ?? 'Failed to fire test errors', 'error');
        return;
      }

      // Unexpected 2xx — treat as success with no traceId
      addToast('Test error fired successfully', 'success');
    } catch {
      addToast('Failed to fire test errors', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-destructive/10 text-destructive font-bold text-sm">
          🔥
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground">Fire Test Sentry Error</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fires 1 random synthetic Sentry error to test the webhook → incident → investigation
            pipeline.
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={handleFire}
        className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors focus:outline-none focus:ring-2 focus:ring-destructive/50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Firing errors...
          </>
        ) : (
          'Fire Test Error'
        )}
      </button>

      {lastFiredTraceId && (
        <p className="text-xs text-muted-foreground">
          Last fired: trace <span className="font-mono">{lastFiredTraceId}</span>
        </p>
      )}
    </div>
  );
}

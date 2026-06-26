'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureException } from '@/contexts/shared/lib/monitoring/error-tracker';
import { Link } from '@/i18n/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to console in development; send to error tracker in production
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
    }
    captureException(error, { componentStack: info.componentStack ?? undefined });
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onReset={this.reset} />;
    }

    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Fallback UI
// ---------------------------------------------------------------------------

interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <div
      role="alert"
      className="flex min-h-[400px] flex-col items-center justify-center gap-6 rounded-xl border border-border bg-card p-8 text-center"
    >
      {/* Illustration */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive text-3xl">
        ⚠
      </div>

      {/* Text */}
      <div className="space-y-2 max-w-sm">
        <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred. Please try again or go back to the dashboard.
        </p>
      </div>

      {/* Dev error details */}
      {isDev && error && (
        <details className="w-full max-w-lg text-left">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            Error Details (dev only)
          </summary>
          <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground whitespace-pre-wrap break-all">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
        </details>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          Try Again
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

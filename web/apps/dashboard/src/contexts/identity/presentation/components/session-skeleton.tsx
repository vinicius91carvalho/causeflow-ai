'use client';

import { cn } from '@causeflow/ui/lib';

/**
 * Skeleton loader shown while the session is being fetched.
 * Used to prevent layout shift / FOUC in the dashboard.
 */
export function SessionSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('flex h-screen w-screen items-center justify-center bg-background', className)}
      aria-live="polite"
    >
      <div className="space-y-4 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 animate-pulse">
          <div className="h-6 w-6 rounded bg-primary/30" />
        </div>
        <div className="space-y-2">
          <div className="h-2 w-32 rounded-full bg-muted animate-pulse mx-auto" />
          <div className="h-2 w-24 rounded-full bg-muted animate-pulse mx-auto" />
        </div>
      </div>
    </div>
  );
}

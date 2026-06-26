'use client';

import { cn } from '@causeflow/ui/lib';

interface CauseFlowLoaderProps {
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CauseFlowLoader({ message, className, size = 'md' }: CauseFlowLoaderProps) {
  const dim = size === 'sm' ? 'h-16 w-16' : size === 'lg' ? 'h-32 w-32' : 'h-24 w-24';

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className={cn('relative', dim)}>
        {/* Spinning arc — primary visual */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full animate-spin"
          style={{ animationDuration: '1.2s' }}
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="hsl(var(--primary) / 0.12)"
            strokeWidth="4"
          />
          {/* Spinning arc */}
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="110 166"
          />
        </svg>

        {/* Slow counter-spinning outer glow ring */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full animate-spin"
          style={{ animationDuration: '3s', animationDirection: 'reverse' }}
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="none"
            stroke="hsl(var(--primary) / 0.15)"
            strokeWidth="1"
            strokeDasharray="20 30"
          />
        </svg>

        {/* Center logo */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/logo.png"
            alt=""
            className={cn(
              'object-contain',
              size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10',
            )}
          />
        </div>
      </div>

      {message && <p className="text-sm text-muted-foreground animate-pulse">{message}</p>}
    </div>
  );
}

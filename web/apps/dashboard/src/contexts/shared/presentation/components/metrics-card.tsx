'use client';

import { cn } from '@causeflow/ui/lib';
import type { LucideIcon } from 'lucide-react';

interface MetricsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  loading?: boolean;
}

function MetricsCardSkeleton() {
  return (
    <output
      className="rounded-lg border border-border bg-card p-4 shadow-sm animate-pulse block"
      aria-busy="true"
      aria-label="Loading metric"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-8 w-8 rounded-lg bg-muted" />
      </div>
      <div className="h-7 w-16 rounded bg-muted" />
    </output>
  );
}

export function MetricsCard({
  label,
  value,
  icon: Icon,
  trend,
  loading = false,
}: MetricsCardProps) {
  if (loading) {
    return <MetricsCardSkeleton />;
  }

  return (
    <div className="group rounded-lg border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all duration-200 group-hover:scale-110">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {trend && (
        <p className={cn('mt-1 text-xs', trend.value >= 0 ? 'text-success' : 'text-destructive')}>
          {trend.value >= 0 ? '+' : ''}
          {trend.value}% {trend.label}
        </p>
      )}
    </div>
  );
}

export { MetricsCardSkeleton };

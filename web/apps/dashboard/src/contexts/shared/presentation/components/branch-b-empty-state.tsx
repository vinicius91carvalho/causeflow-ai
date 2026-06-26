'use client';

import { Search, Shield, Zap } from 'lucide-react';
import { Link } from '@/i18n/navigation';

interface BranchBMessages {
  title: string;
  subtitle: string;
  createFirstAnalysis: string;
  feature1: string;
  feature2: string;
  feature3: string;
}

interface BranchBEmptyStateProps {
  messages: BranchBMessages;
}

export function BranchBEmptyState({ messages }: BranchBEmptyStateProps) {
  return (
    <div
      data-testid="branch-b-empty-state"
      className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-8 text-center"
    >
      {/* Icon */}
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Search className="h-8 w-8" aria-hidden="true" />
      </div>

      {/* Title + subtitle */}
      <h2 className="text-xl font-bold text-foreground">{messages.title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{messages.subtitle}</p>

      {/* Single CTA */}
      <Link
        href="/dashboard/analyses/new"
        data-testid="cta-create-first-analysis"
        className="mt-6 inline-flex items-center gap-2 rounded-md border border-warning bg-card px-4 py-2 text-sm font-semibold text-warning transition-all duration-200 hover:bg-warning/10 hover:scale-105 hover:shadow-md active:scale-95"
      >
        {messages.createFirstAnalysis}
      </Link>

      {/* Feature highlights */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3 text-left w-full max-w-lg">
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Search className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="text-xs font-medium text-foreground mt-1">{messages.feature1}</p>
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Zap className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="text-xs font-medium text-foreground mt-1">{messages.feature2}</p>
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Shield className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="text-xs font-medium text-foreground mt-1">{messages.feature3}</p>
        </div>
      </div>
    </div>
  );
}

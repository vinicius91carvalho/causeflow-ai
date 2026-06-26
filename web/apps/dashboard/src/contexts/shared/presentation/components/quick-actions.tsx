'use client';

import { Plug, Plus } from 'lucide-react';
import { Link } from '@/i18n/navigation';

interface QuickActionsProps {
  newAnalysisLabel: string;
  connectIntegrationLabel: string;
}

export function QuickActions({ newAnalysisLabel, connectIntegrationLabel }: QuickActionsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* New Analysis */}
      <Link
        href="/dashboard/analyses/new"
        className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 group"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all duration-200 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110">
          <Plus className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{newAnalysisLabel}</p>
        </div>
      </Link>

      {/* Connect Integration */}
      <Link
        href="/dashboard/integrations"
        className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 group"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-all duration-200 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110">
          <Plug className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{connectIntegrationLabel}</p>
        </div>
      </Link>
    </div>
  );
}

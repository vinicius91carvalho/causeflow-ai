'use client';

import { Clock } from 'lucide-react';

/** Average hours saved per incident investigation when using CauseFlow AI */
export const HOURS_PER_ANALYSIS = 4;

interface SavingHoursProps {
  monthlyAnalyses: number;
  displayText: string;
  loading?: boolean;
}

export function calculateHoursSaved(analysesCount: number): number {
  return analysesCount * HOURS_PER_ANALYSIS;
}

function SavingHoursSkeleton() {
  return (
    <output
      className="rounded-lg border border-border bg-card p-4 animate-pulse block"
      aria-busy="true"
      aria-label="Loading savings"
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted" />
        <div className="h-4 w-60 rounded bg-muted" />
      </div>
    </output>
  );
}

export function SavingHours({ monthlyAnalyses, displayText, loading = false }: SavingHoursProps) {
  if (loading) {
    return <SavingHoursSkeleton />;
  }

  // Hidden when there are no analyses
  if (monthlyAnalyses === 0) {
    return null;
  }

  const hoursSaved = calculateHoursSaved(monthlyAnalyses);

  const text = displayText
    .replace('{hours}', String(hoursSaved))
    .replace('{analyses}', String(monthlyAnalyses));

  return (
    <section
      className="rounded-lg border border-primary/20 bg-primary/5 p-4"
      aria-label="Time saved this month"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Clock className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-foreground">{text}</p>
      </div>
    </section>
  );
}

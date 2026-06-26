import { cn } from '@causeflow/ui/lib';
import { Card, CardContent } from '@causeflow/ui/primitives';
import type { ReactNode } from 'react';

interface MetricCardProps {
  value: ReactNode;
  label: string;
  description?: string;
  source?: string;
  sourceUrl?: string;
  className?: string;
}

export function MetricCard({
  value,
  label,
  description,
  source,
  sourceUrl,
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        'h-full min-h-[180px] text-center backdrop-blur-sm bg-card/80 ring-1 ring-accent/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-accent/5 hover:ring-accent/20',
        className,
      )}
    >
      <CardContent className="flex flex-col items-center gap-2 pt-6 h-full">
        <div className="min-h-[48px] flex items-center justify-center text-2xl font-bold text-primary sm:text-3xl">
          {value}
        </div>
        <div className="text-sm font-medium text-muted-foreground text-center">{label}</div>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
        {source && (
          <p className="mt-3 text-xs text-muted-foreground/70">
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-muted-foreground hover:underline"
              >
                {source}
              </a>
            ) : (
              source
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

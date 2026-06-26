'use client';
import { cn } from '@causeflow/ui/lib';
import { Badge, Card, CardContent } from '@causeflow/ui/primitives';

interface IntegrationCardProps {
  name: string;
  category: string;
  description: string;
  differentiator?: string;
  agentConnection?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function IntegrationCard({
  name,
  category,
  description,
  differentiator,
  agentConnection,
  icon,
  className,
}: IntegrationCardProps) {
  return (
    <Card
      className={cn(
        'h-full transition-all duration-300',
        'bg-card border border-border/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10 hover:border-primary/50',
        className,
      )}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {icon && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                {icon}
              </div>
            )}
            <h3 className="font-semibold">{name}</h3>
          </div>
        </div>
        <Badge variant="outline" className="mt-2 text-xs">
          {category}
        </Badge>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
        {differentiator && (
          <p className="mt-2 text-xs text-primary font-medium">{differentiator}</p>
        )}
        {agentConnection && (
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground/70">
            <span aria-hidden="true">🔗</span>
            <span>{agentConnection}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

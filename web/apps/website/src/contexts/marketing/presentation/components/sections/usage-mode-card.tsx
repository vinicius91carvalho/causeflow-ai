import { cn } from '@causeflow/ui/lib';
import { Card, CardContent } from '@causeflow/ui/primitives';

interface UsageModeCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  disabledLabel?: string;
  className?: string;
}

export function UsageModeCard({
  title,
  description,
  icon,
  disabled,
  disabledLabel,
  className,
}: UsageModeCardProps) {
  return (
    <Card
      className={cn(
        'group h-full',
        disabled
          ? 'opacity-50 cursor-default'
          : 'hover:-translate-y-1 hover:bg-accent hover:border-accent hover:shadow-lg hover:shadow-accent/20',
        className,
      )}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          {icon && (
            <div
              className={cn(
                'mb-3 transition-colors duration-300',
                disabled
                  ? 'text-muted-foreground'
                  : 'text-primary group-hover:text-accent-foreground',
              )}
            >
              {icon}
            </div>
          )}
          {disabled && disabledLabel && (
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {disabledLabel}
            </span>
          )}
        </div>
        <h3
          className={cn(
            'font-semibold transition-colors duration-300',
            disabled ? 'text-muted-foreground' : 'group-hover:text-accent-foreground',
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            'mt-1 text-sm transition-colors duration-300',
            disabled
              ? 'text-muted-foreground/60'
              : 'text-muted-foreground group-hover:text-accent-foreground/80',
          )}
        >
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

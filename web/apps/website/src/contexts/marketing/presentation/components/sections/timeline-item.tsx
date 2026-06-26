import { cn } from '@causeflow/ui/lib';

interface TimelineItemProps {
  step: string;
  title: string;
  description: string;
  isLast?: boolean;
  className?: string;
}

export function TimelineItem({ step, title, description, isLast, className }: TimelineItemProps) {
  return (
    <div
      className={cn(
        'relative flex gap-4 pb-8',
        !isLast && 'border-l-2 border-border ml-5',
        className,
      )}
    >
      <div className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {step}
      </div>
      <div className="ml-6">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

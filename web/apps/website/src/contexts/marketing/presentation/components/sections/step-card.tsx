import { cn } from '@causeflow/ui/lib';

interface StepCardProps {
  number: number;
  title: string;
  description: string;
  className?: string;
}

export function StepCard({ number, title, description, className }: StepCardProps) {
  return (
    <div
      className={cn(
        'group flex gap-4 rounded-lg p-3 transition-all duration-300 hover:-translate-y-1 hover:bg-accent hover:shadow-lg hover:shadow-accent/20',
        className,
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition-colors duration-300 group-hover:bg-accent-foreground/20 group-hover:text-accent-foreground">
        {number}
      </div>
      <div>
        <h3 className="font-semibold transition-colors duration-300 group-hover:text-accent-foreground">
          {title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground transition-colors duration-300 group-hover:text-accent-foreground/80">
          {description}
        </p>
      </div>
    </div>
  );
}

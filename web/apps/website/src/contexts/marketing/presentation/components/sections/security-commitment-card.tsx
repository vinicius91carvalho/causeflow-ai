import { cn } from '@causeflow/ui/lib';
import { Card, CardContent } from '@causeflow/ui/primitives';

interface SecurityCommitmentCardProps {
  title: string;
  description: string;
  technicalDetail?: string;
  className?: string;
}

export function SecurityCommitmentCard({
  title,
  description,
  technicalDetail,
  className,
}: SecurityCommitmentCardProps) {
  return (
    <Card
      className={cn(
        'group h-full backdrop-blur-sm bg-card/80 ring-1 ring-accent/10 transition-all duration-300 hover:-translate-y-1 hover:bg-accent hover:border-accent hover:ring-0 hover:shadow-lg hover:shadow-accent/20',
        className,
      )}
    >
      <CardContent className="pt-6">
        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-success/10 text-success transition-colors duration-300 group-hover:bg-accent-foreground/20 group-hover:text-accent-foreground">
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
        </div>
        <h3 className="font-semibold transition-colors duration-300 group-hover:text-accent-foreground">
          {title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground transition-colors duration-300 group-hover:text-accent-foreground/80">
          {description}
        </p>
        {technicalDetail && (
          <p className="mt-2 text-xs text-muted-foreground italic transition-colors duration-300 group-hover:text-accent-foreground/60">
            {technicalDetail}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

import { cn } from '@causeflow/ui/lib';
import { Card, CardContent, CardHeader, CardTitle } from '@causeflow/ui/primitives';

interface FeatureCardProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

export function FeatureCard({ icon, title, description, className }: FeatureCardProps) {
  return (
    <Card
      className={cn(
        'group h-full hover:-translate-y-1 hover:bg-accent hover:border-accent hover:shadow-lg hover:shadow-accent/20',
        className,
      )}
    >
      <CardHeader>
        {icon && (
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-accent-foreground/20 group-hover:text-accent-foreground">
            {icon}
          </div>
        )}
        <CardTitle className="text-lg transition-colors duration-300 group-hover:text-accent-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground transition-colors duration-300 group-hover:text-accent-foreground/80">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

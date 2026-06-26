import { cn } from '@causeflow/ui/lib';
import { Card, CardContent } from '@causeflow/ui/primitives';

interface FounderCardProps {
  role: string;
  background: string;
  responsibility: string;
  className?: string;
}

export function FounderCard({ role, background, responsibility, className }: FounderCardProps) {
  return (
    <Card
      className={cn(
        'group h-full -translate-y-1 bg-accent border-accent shadow-lg shadow-accent/20',
        className,
      )}
    >
      <CardContent className="pt-6">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-2xl font-bold text-white">
          {role.charAt(0)}
        </div>
        <h3 className="font-semibold text-white">{role}</h3>
        <p className="mt-1 text-sm text-white">{background}</p>
        <p className="mt-2 text-xs text-white">{responsibility}</p>
      </CardContent>
    </Card>
  );
}

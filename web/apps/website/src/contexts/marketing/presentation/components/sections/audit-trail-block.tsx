import { cn } from '@causeflow/ui/lib';

interface AuditTrailBlockProps {
  lines: string[];
  className?: string;
}

export function AuditTrailBlock({ lines, className }: AuditTrailBlockProps) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-lg bg-slate-950 p-6 font-mono text-sm text-slate-300',
        className,
      )}
    >
      {lines.map((line, i) => (
        <div key={`${i}-${line}`} className="whitespace-pre">
          {line}
        </div>
      ))}
    </div>
  );
}

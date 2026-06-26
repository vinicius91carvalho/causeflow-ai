import type { RemediationStatus } from '@/contexts/investigation/domain/types';

const statusClasses: Record<RemediationStatus, string> = {
  proposed: 'border-warning/40 bg-warning/10 text-warning',
  approved: 'border-success/40 bg-success/10 text-success',
  rejected: 'border-destructive/40 bg-destructive/10 text-destructive',
  executing: 'border-primary/40 bg-primary/10 text-primary',
  completed: 'border-success/40 bg-success/10 text-success',
  failed: 'border-destructive/40 bg-destructive/10 text-destructive',
};

interface RemediationStatusBadgeProps {
  status: RemediationStatus;
  label: string;
}

export function RemediationStatusBadge({ status, label }: RemediationStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClasses[status] ?? statusClasses.proposed}`}
    >
      {status === 'executing' && (
        <span className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-pulse" aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

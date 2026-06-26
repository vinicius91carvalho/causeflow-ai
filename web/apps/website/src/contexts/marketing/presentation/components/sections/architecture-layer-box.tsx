import { cn } from '@causeflow/ui/lib';

interface ArchitectureLayerBoxProps {
  /** Icon element to display */
  icon: React.ReactNode;
  /** Icon background color class (e.g. "bg-chart-1") */
  iconBg: string;
  /** Main text or title */
  title: string;
  /** Optional subtitle (product variant only) */
  subtitle?: string;
  /** Border/bg color for product variant (e.g. "border-chart-1 bg-chart-1/10") */
  colorClasses?: string;
  /** Visual style variant */
  variant?: 'security' | 'product';
}

export function ArchitectureLayerBox({
  icon,
  iconBg,
  title,
  subtitle,
  colorClasses,
  variant = 'security',
}: ArchitectureLayerBoxProps) {
  if (variant === 'product') {
    return (
      <div className={cn('rounded-lg border-2 p-6', colorClasses)}>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-white',
              iconBg,
            )}
          >
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-white">{title}</h3>
            {subtitle && <p className="text-sm text-white/70">{subtitle}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-5">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-white',
            iconBg,
          )}
        >
          {icon}
        </div>
        <p className="text-sm text-slate-300">{title}</p>
      </div>
    </div>
  );
}

const ArrowDown = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={cn('text-slate-500', className)}
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
  </svg>
);

export function ArchitectureArrow({ variant = 'security' }: { variant?: 'security' | 'product' }) {
  return (
    <div className="flex justify-center">
      <ArrowDown
        className={variant === 'product' ? 'h-8 w-8 text-white/30' : 'h-6 w-6 text-slate-500'}
      />
    </div>
  );
}

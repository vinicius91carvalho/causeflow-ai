/**
 * MetaStrip — read-time · severity · impact · resolvedIn chip row.
 *
 * Severity tone mapping:
 *   high   → text-red-600   bg-red-500/10
 *   medium → text-amber-600 bg-amber-500/10
 *   low    → text-muted-foreground bg-muted/40
 *
 * The optional `resolvedIn` chip highlights how fast CauseFlow fixed
 * the incident — styled in accent + check icon so it reads as the
 * page's money stat.
 */

export interface MetaStripProps {
  readTime: string;
  severity: {
    label: string;
    tone: 'high' | 'medium' | 'low';
  };
  impact: string;
  resolvedIn?: string;
}

const severityClasses: Record<'high' | 'medium' | 'low', string> = {
  high: 'text-red-600 bg-red-500/10',
  medium: 'text-amber-600 bg-amber-500/10',
  low: 'text-muted-foreground bg-muted/40',
};

export function MetaStrip({ readTime, severity, impact, resolvedIn }: MetaStripProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
      {/* Read-time chip */}
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-muted-foreground">
        <ClockIcon />
        {readTime}
      </span>

      {/* Severity chip */}
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${severityClasses[severity.tone]}`}
      >
        <SeverityIcon />
        {severity.label}
      </span>

      {/* Impact chip */}
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-muted-foreground">
        <ImpactIcon />
        {impact}
      </span>

      {/* Resolved-by-CauseFlow chip — accent, optional but recommended */}
      {resolvedIn && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-semibold text-accent">
          <CheckIcon />
          {resolvedIn}
        </span>
      )}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-3.5 w-3.5"
    >
      <circle cx="8" cy="8" r="6.5" />
      <path strokeLinecap="round" d="M8 5v3.5l2 1.5" />
    </svg>
  );
}

function SeverityIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-3.5 w-3.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 2l1.5 4h4l-3 2.5 1 4L8 10l-3.5 2.5 1-4L2.5 6h4z"
      />
    </svg>
  );
}

function ImpactIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-3.5 w-3.5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12l4-4 3 3 5-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-3.5 w-3.5"
    >
      <circle cx="8" cy="8" r="6.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l2 2 4-4.5" />
    </svg>
  );
}

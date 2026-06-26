/**
 * EvidenceCard — monospace card for logs / DB snapshots / raw output.
 *
 * tone variants:
 *   default → neutral muted border
 *   warn    → amber border
 *   error   → red border
 */

export interface EvidenceCardProps {
  title?: string;
  lines: string[];
  tone?: 'default' | 'warn' | 'error';
}

const toneClasses: Record<'default' | 'warn' | 'error', string> = {
  default: 'border-border bg-muted/40',
  warn: 'border-amber-500/40 bg-amber-500/5',
  error: 'border-red-500/40 bg-red-500/5',
};

const titleToneClasses: Record<'default' | 'warn' | 'error', string> = {
  default: 'text-muted-foreground',
  warn: 'text-amber-600',
  error: 'text-red-600',
};

export function EvidenceCard({ title, lines, tone = 'default' }: EvidenceCardProps) {
  return (
    <div className={`overflow-hidden rounded-xl border ${toneClasses[tone]}`}>
      {title && (
        <div
          className={`border-b border-inherit px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] ${titleToneClasses[tone]}`}
        >
          {title}
        </div>
      )}
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-[1.65] text-foreground/80">
        {lines.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static evidence lines — no reorder
          <div key={i}>{line}</div>
        ))}
      </pre>
    </div>
  );
}

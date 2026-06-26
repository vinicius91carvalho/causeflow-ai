/**
 * FixOptions — three fix-option cards for the broken-images case study.
 *
 * Cards use border-border bg-card pattern with hover lift.
 * An optional badge marks a recommended option.
 * No call-to-action per spec: CauseFlow surfaces options, humans decide.
 *
 * All strings come from props (i18n-resolved by the page).
 */

export interface FixOption {
  id: string;
  title: string;
  tradeoff: string;
  badge?: string;
}

export interface FixOptionsProps {
  sectionTitle: string;
  sectionLead: string;
  options: FixOption[];
}

export function FixOptions({ sectionTitle, sectionLead, options }: FixOptionsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-[1.05rem] font-semibold tracking-tight text-foreground">
          {sectionTitle}
        </h2>
        <p className="text-[15px] leading-[1.6] text-muted-foreground">{sectionLead}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {options.map((option) => (
          <div
            key={option.id}
            className="relative rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-px hover:shadow-[0_4px_16px_-4px_hsl(var(--foreground)/0.08)]"
          >
            {/* Optional badge */}
            {option.badge && (
              <span className="mb-3 inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
                {option.badge}
              </span>
            )}

            <h3 className="text-[14px] font-semibold leading-snug text-foreground">
              {option.title}
            </h3>

            <p className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">
              {option.tradeoff}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

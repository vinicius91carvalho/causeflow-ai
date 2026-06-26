/**
 * SymptomToRcTimeline — Scenario 01 (Stale Pricing)
 *
 * Vertical 4-step timeline tracing the investigation path from the visible
 * symptom (/pricing shows stale data) to the two overlapping root causes.
 * Each step includes a short CauseFlow-style "inference" caption.
 *
 * All copy comes via props (i18n-resolved strings from the page).
 * Mobile-first: full-width, readable on narrow screens.
 */

export interface TimelineStep {
  label: string;
  inference: string;
  tone?: 'default' | 'finding' | 'root-cause';
}

export interface SymptomToRcTimelineProps {
  steps: [TimelineStep, TimelineStep, TimelineStep, TimelineStep];
}

const toneDot: Record<'default' | 'finding' | 'root-cause', string> = {
  default: 'bg-muted border-border',
  finding: 'bg-amber-500/20 border-amber-500/50',
  'root-cause': 'bg-red-500/20 border-red-500/60',
};

const toneLabel: Record<'default' | 'finding' | 'root-cause', string> = {
  default: 'text-foreground',
  finding: 'text-amber-600',
  'root-cause': 'text-red-600',
};

export function SymptomToRcTimeline({ steps }: SymptomToRcTimelineProps) {
  return (
    <ol className="relative w-full max-w-[680px] space-y-0" aria-label="Investigation timeline">
      {steps.map((step, index) => {
        const tone = step.tone ?? 'default';
        const isLast = index === steps.length - 1;

        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: static ordered timeline steps
          <li key={index} className="relative flex gap-5 pb-8 last:pb-0">
            {/* Vertical connector line */}
            {!isLast && (
              <div
                aria-hidden="true"
                className="absolute left-[17px] top-[34px] h-[calc(100%-34px)] w-px bg-border"
              />
            )}

            {/* Step dot */}
            <div className="relative mt-1 shrink-0">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 font-mono text-[11px] font-bold ${toneDot[tone]}`}
              >
                <span className={toneLabel[tone]}>{index + 1}</span>
              </div>
            </div>

            {/* Step content */}
            <div className="flex-1 pt-1">
              <p className={`text-[15px] font-semibold leading-[1.4] ${toneLabel[tone]}`}>
                {step.label}
              </p>
              <p className="mt-1.5 font-mono text-[12.5px] leading-[1.6] text-muted-foreground">
                {/* inference caption — CauseFlow reasoning note */}↳ {step.inference}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

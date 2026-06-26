/**
 * AlertsInvestigationSection — Second duo-section, "#alerts".
 * "Do alerta crítico à resposta acionável." — 4-step flow visualization.
 */

interface AlertStep {
  title: string;
  description: string;
  time: string;
  status: 'done' | 'active' | 'pending';
}

interface AlertsInvestigationSectionProps {
  eyebrow: string;
  headline: { p1: string; em: string };
  lead: string;
  steps: AlertStep[];
  sevLabels: { low: string; medium: string; high: string; critical: string };
}

export function AlertsInvestigationSection({
  eyebrow,
  headline,
  lead,
  steps,
  sevLabels,
}: AlertsInvestigationSectionProps) {
  return (
    <section id="alerts" className="bg-background px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left: copy */}
          <div>
            <p className="font-mono text-[11.5px] font-bold uppercase tracking-[0.15em] text-accent">
              {eyebrow}
            </p>
            <h2
              className="mt-4 text-balance font-display font-normal tracking-[-0.03em] text-foreground"
              style={{ fontSize: 'clamp(2rem, 3vw + 0.8rem, 3.2rem)', lineHeight: 1.02 }}
            >
              <span>{headline.p1}</span>
              <br />
              <em className="not-italic font-medium text-[hsl(var(--brand-purple))]">
                {headline.em}
              </em>
            </h2>
            <p className="mt-5 max-w-md text-pretty text-[17px] leading-[1.55] text-muted-foreground">
              {lead}
            </p>
          </div>

          {/* Right: step flow visualization */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="space-y-0">
              {steps.map((step, i) => (
                <div key={step.title} className="relative flex gap-4">
                  {/* Connector line */}
                  {i < steps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={`absolute left-4 top-9 h-full w-px ${step.status === 'done' ? 'bg-accent/40' : 'bg-border'}`}
                    />
                  )}

                  {/* Step icon */}
                  <div
                    className={`relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                      step.status === 'done'
                        ? 'border-accent/40 bg-accent/10 text-accent'
                        : step.status === 'active'
                          ? 'border-amber-300 bg-amber-50 text-amber-600'
                          : 'border-border bg-muted/40 text-muted-foreground'
                    }`}
                  >
                    <StepIcon status={step.status} index={i} />
                  </div>

                  {/* Step content */}
                  <div className="min-w-0 flex-1 pb-8">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-semibold ${step.status === 'pending' ? 'text-muted-foreground' : 'text-foreground'}`}
                        >
                          {step.title}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {step.description}
                        </p>
                        {/* Severity chips — only on step 2 (classification) */}
                        {i === 1 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {(['low', 'medium', 'high', 'critical'] as const).map((sev) => (
                              <span
                                key={sev}
                                className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                                  sev === 'high'
                                    ? 'border-red-300 bg-red-100 text-red-700'
                                    : 'border-border bg-muted/40 text-muted-foreground'
                                }`}
                              >
                                {sevLabels[sev]}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {step.time}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StepIcon({ status, index }: { status: AlertStep['status']; index: number }) {
  if (status === 'done') {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="h-3.5 w-3.5"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (status === 'active') {
    return (
      <span aria-hidden="true" className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="font-mono text-[10px] font-bold text-muted-foreground/50">
      {index + 1}
    </span>
  );
}

/**
 * ParanoidByDesignSection — Cleric.ai-inspired security strip.
 *
 * Two categories × three cards each:
 *   1. Minimum Access with Full Control — data handling + agent write posture
 *   2. Isolation and Transparency       — tenant isolation + auditability
 *
 * Each card declares a title, a plain-language description, a terse monospace
 * "tech note" summary, and an optional `future` flag that renders a roadmap
 * badge (for capabilities that are planned but not yet live).
 */

interface ParanoidCard {
  icon: 'readonly' | 'scope' | 'approve' | 'tenant' | 'no-train' | 'audit';
  title: string;
  description: string;
  techNote: string;
  future?: boolean;
}

interface ParanoidGroup {
  title: string;
  cards: ParanoidCard[];
}

interface ParanoidByDesignSectionProps {
  eyebrow: string;
  headline: { p1: string; em: string };
  lead: string;
  futureLabel: string;
  groups: ParanoidGroup[];
}

export function ParanoidByDesignSection({
  eyebrow,
  headline,
  lead,
  futureLabel,
  groups,
}: ParanoidByDesignSectionProps) {
  return (
    <section className="bg-muted/60 px-4 py-[110px] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        {/* Header */}
        <div className="mx-auto mb-14 max-w-[720px] text-center">
          <p className="font-mono text-[11.5px] font-bold uppercase tracking-[0.15em] text-accent">
            {eyebrow}
          </p>
          <h2
            className="mt-4 text-balance font-display font-normal tracking-[-0.03em] text-foreground"
            style={{ fontSize: 'clamp(2rem, 3vw + 0.8rem, 3.2rem)', lineHeight: 1.02 }}
          >
            <span>{headline.p1} </span>
            <em className="not-italic font-medium text-accent">{headline.em}</em>
          </h2>
          <p className="mt-4 text-pretty text-[17px] leading-[1.55] text-muted-foreground">
            {lead}
          </p>
        </div>

        {/* Groups */}
        <div className="flex flex-col gap-14">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-6 text-center font-display text-[22px] font-normal tracking-[-0.01em] text-foreground sm:text-left">
                {group.title}
              </h3>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {group.cards.map((card) => (
                  <article
                    key={card.title}
                    className="group relative flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-[0_1px_2px_hsl(var(--foreground)/0.04)] transition-all duration-300 hover:border-accent/40 hover:shadow-[0_8px_22px_-12px_hsl(var(--accent)/0.35)]"
                  >
                    {card.future && (
                      <span className="absolute right-4 top-4 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] text-accent">
                        {futureLabel}
                      </span>
                    )}
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <ParanoidIcon kind={card.icon} />
                    </span>
                    <h4 className="text-[16px] font-bold leading-[1.3] tracking-[-0.01em] text-foreground">
                      {card.title}
                    </h4>
                    <p className="text-[14px] leading-[1.55] text-muted-foreground">
                      {card.description}
                    </p>
                    <p className="mt-auto rounded-md bg-foreground/[0.04] px-2.5 py-1.5 font-mono text-[11px] leading-[1.45] text-foreground/75">
                      {card.techNote}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ParanoidIcon({ kind }: { kind: ParanoidCard['icon'] }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'h-5 w-5',
  };
  switch (kind) {
    case 'readonly':
      return (
        <svg aria-hidden="true" {...common}>
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'scope':
      return (
        <svg aria-hidden="true" {...common}>
          <rect width="18" height="11" x="3" y="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case 'approve':
      return (
        <svg aria-hidden="true" {...common}>
          <path d="M20 6 9 17l-5-5" />
          <circle cx="12" cy="12" r="10" opacity="0.25" />
        </svg>
      );
    case 'tenant':
      return (
        <svg aria-hidden="true" {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'no-train':
      return (
        <svg aria-hidden="true" {...common}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'audit':
      return (
        <svg aria-hidden="true" {...common}>
          <path d="M8 6h13M8 12h13M8 18h13" />
          <circle cx="3.5" cy="6" r="1.2" />
          <circle cx="3.5" cy="12" r="1.2" />
          <circle cx="3.5" cy="18" r="1.2" />
        </svg>
      );
  }
}

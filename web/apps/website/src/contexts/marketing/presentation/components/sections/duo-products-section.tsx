/**
 * DuoProductsSection — First duo-section.
 * "DOIS PRODUTOS, UM FRAMEWORK" — two duo-cards (AI SRE + AI Customer Ops).
 */

interface DuoCard {
  tag: string;
  title1: string;
  title2: string;
  description: string;
  sampleLabel: string;
  items: Array<{ icon: '→' | '✓'; text: string; mono?: string }>;
}

interface DuoProductsSectionProps {
  eyebrow: string;
  headline: { p1: string; em1: string; p2: string; em2: string; p3: string };
  lead: string;
  sreCard: DuoCard;
  opsCard: DuoCard;
}

export function DuoProductsSection({
  eyebrow,
  headline,
  lead,
  sreCard,
  opsCard,
}: DuoProductsSectionProps) {
  return (
    <section className="bg-background px-4 py-[110px] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        {/* Section header */}
        <div className="mx-auto mb-14 max-w-[640px] text-center">
          <p className="font-mono text-[11.5px] font-bold uppercase tracking-[0.15em] text-accent">
            {eyebrow}
          </p>
          <h2
            className="mt-4 text-balance font-display font-normal tracking-[-0.03em] text-foreground"
            style={{ fontSize: 'clamp(1.6rem, 2vw + 0.6rem, 2.4rem)', lineHeight: 1.1 }}
          >
            <span>{headline.p1} </span>
            <em className="not-italic font-medium text-accent">{headline.em1}</em>
            <span> {headline.p2} </span>
            <em className="not-italic font-medium text-[hsl(var(--violet))]">{headline.em2}</em>
            <br />
            <span>{headline.p3}</span>
          </h2>
          <p className="mt-4 text-pretty text-[17px] leading-[1.55] text-muted-foreground">
            {lead}
          </p>
        </div>

        {/* Duo cards */}
        <div className="grid gap-6 lg:grid-cols-2">
          <DuoCard card={sreCard} palette="accent" />
          <DuoCard card={opsCard} palette="violet" />
        </div>
      </div>
    </section>
  );
}

type Palette = 'accent' | 'violet';

function DuoCard({ card, palette }: { card: DuoCard; palette: Palette }) {
  const paletteText = palette === 'accent' ? 'text-accent' : 'text-[hsl(var(--violet))]';
  const paletteDot = palette === 'accent' ? 'bg-accent' : 'bg-[hsl(var(--violet))]';
  const paletteTag =
    palette === 'accent'
      ? 'bg-accent/10 text-accent'
      : 'bg-[hsl(var(--violet)/0.1)] text-[hsl(var(--violet))]';
  return (
    <div className="rounded-2xl border border-border bg-card p-8">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] ${paletteTag}`}
      >
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${paletteDot}`} />
        {card.tag}
      </span>
      <h3
        className="mt-5 font-display font-normal tracking-[-0.02em] text-foreground"
        style={{ fontSize: '28px', lineHeight: 1.1 }}
      >
        <span>{card.title1}</span>
        <br />
        <em className={`not-italic font-medium ${paletteText}`}>{card.title2}</em>
      </h3>
      <p className="mt-4 text-[15px] leading-[1.55] text-muted-foreground">{card.description}</p>

      {/* Sample terminal */}
      <div className="mt-6 rounded-xl border border-border bg-background">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${paletteDot} shadow-[0_0_4px_currentColor]`}
          />
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {card.sampleLabel}
          </span>
        </div>
        <ul className="space-y-1.5 p-4">
          {card.items.map((item) => (
            <li
              key={item.text}
              className={`flex items-start gap-2 font-mono text-[12px] leading-[1.6] ${item.icon === '✓' ? 'font-semibold text-foreground' : 'text-foreground/70'}`}
            >
              <span
                className={`mt-px shrink-0 ${item.icon === '✓' ? paletteText : `${paletteText} opacity-60`}`}
              >
                {item.icon}
              </span>
              <span>
                {item.text}
                {item.mono && (
                  <span className={`rounded px-1 py-0.5 ${paletteTag}`}> {item.mono}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

'use client';

/**
 * UseCasesCarouselSection — horizontal scroll carousel of resolved incident stories.
 *
 * Each card shows: investigation ID + severity chip + icon + title + tags,
 * plus a stats row (time to RC, evidence count, confidence) and a monospace
 * finding block with the root cause summary.
 *
 * When a card has an `href`, the whole card becomes a `<Link>` deep-linking
 * to the matching `/use-cases/<slug>` page — keyboard focusable + routable.
 */

import { useCallback, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';

type Severity = 'high' | 'medium' | 'low';

interface UseCaseCard {
  invId: string;
  severity: Severity;
  icon: string;
  title: string;
  tags: string[];
  rootCauseLabel: string;
  finding: string;
  timeToRc: string;
  evidences: string;
  confidence: string;
  /** Optional deep-link target — when present, the card renders as <Link>. */
  href?: string;
}

interface UseCasesCarouselSectionProps {
  eyebrow: string;
  headline: { p1: string; em: string };
  prevLabel: string;
  nextLabel: string;
  timeLabel: string;
  evLabel: string;
  confLabel: string;
  cards: UseCaseCard[];
}

const severityClass: Record<Severity, string> = {
  high: 'border-red-300 bg-red-100 text-red-700',
  medium: 'border-amber-300 bg-amber-100 text-amber-700',
  low: 'border-border bg-muted/40 text-muted-foreground',
};

export function UseCasesCarouselSection({
  eyebrow,
  headline,
  prevLabel,
  nextLabel,
  timeLabel,
  evLabel,
  confLabel,
  cards,
}: UseCasesCarouselSectionProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  const scrollBy = useCallback((dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-card]');
    const step = card ? card.offsetWidth + 24 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  }, []);

  return (
    <section id="use-cases" className="bg-background px-4 py-[110px] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px]">
        {/* Header + controls */}
        <div className="mb-10 flex items-end justify-between gap-6">
          <div className="max-w-[640px]">
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
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <button
              type="button"
              aria-label={prevLabel}
              onClick={() => scrollBy(-1)}
              disabled={atStart}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
            >
              <CaretIcon direction="left" />
            </button>
            <button
              type="button"
              aria-label={nextLabel}
              onClick={() => scrollBy(1)}
              disabled={atEnd}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
            >
              <CaretIcon direction="right" />
            </button>
          </div>
        </div>

        {/* Scroller */}
        <div
          ref={scrollerRef}
          onScroll={updateEdges}
          className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {cards.map((card) => {
            const inner = (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/20 px-5 py-3.5">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    {card.invId}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] ${severityClass[card.severity]}`}
                  >
                    {card.severity}
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-4 p-5">
                  <h3 className="text-[17px] font-bold leading-[1.3] tracking-[-0.01em] text-foreground">
                    {card.title}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-border bg-muted/30 px-2.5 py-0.5 text-[11px] text-foreground/70"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex-1 rounded-[10px] border border-border bg-muted/40 px-4 py-3.5 font-mono text-[12.5px] leading-[1.7] text-foreground/70">
                    <span className="font-bold text-accent">{card.rootCauseLabel}: </span>
                    {card.finding}
                  </div>
                  <div className="grid grid-cols-3 gap-3 border-t border-border pt-4">
                    <Stat label={timeLabel} value={card.timeToRc} accent />
                    <Stat label={evLabel} value={card.evidences} />
                    <Stat label={confLabel} value={`${card.confidence}%`} accent />
                  </div>
                </div>
              </>
            );

            const baseClass =
              'flex w-[85%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border bg-card sm:w-[460px]';

            return card.href ? (
              <Link
                key={card.invId}
                data-card
                href={card.href}
                className={`${baseClass} transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_6px_20px_-8px_hsl(var(--foreground)/0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
              >
                {inner}
              </Link>
            ) : (
              <article key={card.invId} data-card className={baseClass}>
                {inner}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span
        className={`font-mono text-[15px] font-bold ${accent ? 'text-accent' : 'text-foreground'}`}
      >
        {value}
      </span>
    </div>
  );
}

function CaretIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      style={{ transform: direction === 'left' ? 'rotate(180deg)' : undefined }}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

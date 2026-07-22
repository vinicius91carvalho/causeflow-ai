'use client';

import { useEffect, useState } from 'react';

/**
 * HeroMainHeader — template-faithful hero with persona-colored accents.
 *
 * Features:
 *   - Audience toggle (eng / ops) colour-coded: eng → teal, ops → violet
 *   - Auto-rotates between personas every AUTO_SWITCH_MS until the user clicks
 *     a toggle, after which the rotation stops and the user stays in control.
 *   - Headline + lead crossfade softly on audience change (no typewriter).
 *
 * Surface uses the same `bg-muted/40` tone as the "Segurança em primeiro
 * lugar" block on /security so the two sections feel like one family.
 */

interface HeroMainHeaderProps {
  labels: {
    audEng: string;
    audOps: string;
    eyebrow: string;
    engH1a: string;
    engH1bEm: string;
    engH1bTail: string;
    engLead: string;
    opsH1aPre: string;
    opsH1aEm: string;
    opsH1b: string;
    opsLead: string;
    trust1: string;
    trust2: string;
    trust3: string;
  };
  /** Pass <MiniDashboardVisual> — rendered full-width below the copy. */
  visual: React.ReactNode;
}

const AUTO_SWITCH_MS = 15000;
const FADE_MS = 500; // one-way; full cycle is 2 × FADE_MS

// Template hero background: two soft radial washes (teal + violet) + a dotted grid radially masked.
const heroBgStyle: React.CSSProperties = {
  background: [
    'radial-gradient(ellipse 80% 50% at 85% 10%, hsl(var(--accent) / 0.10), transparent 60%)',
    'radial-gradient(ellipse 60% 40% at 15% 20%, hsl(var(--violet) / 0.06), transparent 60%)',
  ].join(','),
};

// Base section fill: tinted at top (same muted family as rest of page rhythm),
// fading smoothly to --background at the bottom so hero blends into the next block.
const heroSurfaceStyle: React.CSSProperties = {
  background:
    'linear-gradient(180deg, hsl(var(--muted) / 0.55) 0%, hsl(var(--muted) / 0.45) 55%, hsl(var(--background)) 100%)',
};

const heroGridStyle: React.CSSProperties = {
  backgroundImage: [
    'linear-gradient(hsl(var(--foreground) / 0.04) 1px, transparent 1px)',
    'linear-gradient(90deg, hsl(var(--foreground) / 0.04) 1px, transparent 1px)',
  ].join(','),
  backgroundSize: '48px 48px',
  WebkitMaskImage: 'radial-gradient(ellipse 70% 50% at 50% 30%, #000, transparent 75%)',
  maskImage: 'radial-gradient(ellipse 70% 50% at 50% 30%, #000, transparent 75%)',
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function HeroMainHeader({ labels, visual }: HeroMainHeaderProps) {
  const [audience, setAudience] = useState<'eng' | 'ops'>('eng');
  const [autoRotate, setAutoRotate] = useState(true);
  const [visible, setVisible] = useState(true); // controls the fade
  const reducedMotion = usePrefersReducedMotion();

  // Auto-rotate with a soft fade-out → swap → fade-in cycle.
  useEffect(() => {
    if (!autoRotate || reducedMotion) return;
    const tick = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setAudience((a) => (a === 'eng' ? 'ops' : 'eng'));
        setVisible(true);
      }, FADE_MS);
    }, AUTO_SWITCH_MS);
    return () => window.clearInterval(tick);
  }, [autoRotate, reducedMotion]);

  const handleSelect = (next: 'eng' | 'ops') => {
    setAutoRotate(false);
    if (reducedMotion || next === audience) {
      setAudience(next);
      return;
    }
    setVisible(false);
    window.setTimeout(() => {
      setAudience(next);
      setVisible(true);
    }, FADE_MS);
  };

  const lead = audience === 'eng' ? labels.engLead : labels.opsLead;

  const engActiveBg = 'bg-accent text-accent-foreground shadow-sm';
  const opsActiveBg = 'bg-[hsl(var(--violet))] text-white shadow-sm';

  const fadeClass = reducedMotion ? '' : visible ? 'opacity-100' : 'opacity-0';

  return (
    <section
      className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-28 lg:pt-24"
      style={heroSurfaceStyle}
    >
      {/* Layered background — radials + dotted grid (template-faithful) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={heroBgStyle}
      >
        <div className="absolute inset-0" style={heroGridStyle} />
      </div>

      <div className="relative mx-auto max-w-[1200px]">
        {/* Open-source eyebrow — early SEO signal above the H1 */}
        <p className="mb-5 text-center font-mono text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--brand-green))]">
          {labels.eyebrow}
        </p>

        {/* Audience toggle — centered pill */}
        <div className="flex justify-center">
          <fieldset className="inline-flex items-center gap-1 rounded-full border border-border bg-foreground/[0.04] p-1 text-[13px] font-semibold">
            <legend className="sr-only">Audience</legend>
            <button
              type="button"
              onClick={() => handleSelect('eng')}
              aria-pressed={audience === 'eng'}
              className={[
                'inline-flex items-center gap-2 rounded-full px-[18px] py-2 transition-all duration-500 ease-out',
                audience === 'eng' ? engActiveBg : 'text-foreground/70 hover:text-foreground',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className={[
                  'h-1.5 w-1.5 rounded-full transition-all duration-500',
                  audience === 'eng'
                    ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.75)]'
                    : 'bg-foreground/40',
                ].join(' ')}
              />
              {labels.audEng}
            </button>
            <button
              type="button"
              onClick={() => handleSelect('ops')}
              aria-pressed={audience === 'ops'}
              className={[
                'inline-flex items-center gap-2 rounded-full px-[18px] py-2 transition-all duration-500 ease-out',
                audience === 'ops' ? opsActiveBg : 'text-foreground/70 hover:text-foreground',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className={[
                  'h-1.5 w-1.5 rounded-full transition-all duration-500',
                  audience === 'ops'
                    ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.75)]'
                    : 'bg-foreground/40',
                ].join(' ')}
              />
              {labels.audOps}
            </button>
          </fieldset>
        </div>

        {/* Copy block — centered single column. Headline + lead crossfade as a
            group so the two always stay in sync. */}
        <div
          className={`mx-auto mt-8 flex max-w-[960px] flex-col items-center gap-7 text-center transition-opacity ease-out ${fadeClass}`}
          style={{ transitionDuration: `${FADE_MS}ms` }}
        >
          <h1
            className="text-balance font-display font-normal tracking-[-0.035em] text-foreground"
            style={{
              fontSize: 'clamp(2.6rem, 4.5vw + 0.8rem, 5.3rem)',
              lineHeight: 0.98,
            }}
          >
            {audience === 'eng' ? (
              <>
                <span>{labels.engH1a}</span>
                <br />
                <em className="not-italic font-medium text-[hsl(var(--brand-green))]">
                  {labels.engH1bEm}
                </em>
                <span className="text-foreground">{labels.engH1bTail}</span>
              </>
            ) : (
              <>
                <span>{labels.opsH1aPre} </span>
                <em className="not-italic font-medium text-[hsl(var(--brand-purple))]">
                  {labels.opsH1aEm}
                </em>
                <br />
                <span>{labels.opsH1b}</span>
              </>
            )}
          </h1>

          <p className="max-w-[640px] text-pretty text-[19px] leading-[1.55] text-foreground/70">
            {lead}
          </p>

          <ul className="mt-4 flex flex-wrap items-center justify-center gap-7 font-mono text-[11.5px] uppercase tracking-[0.08em] text-foreground/55">
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-[5px] w-[5px] rounded-full bg-[hsl(160_62%_38%)]"
              />
              {labels.trust1}
            </li>
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-[5px] w-[5px] rounded-full bg-[hsl(160_62%_38%)]"
              />
              {labels.trust2}
            </li>
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-[5px] w-[5px] rounded-full bg-[hsl(160_62%_38%)]"
              />
              {labels.trust3}
            </li>
          </ul>
        </div>

        {/* Product visual — full width below the copy */}
        <div className="relative mx-auto mt-16 max-w-[1080px]">{visual}</div>
      </div>
    </section>
  );
}

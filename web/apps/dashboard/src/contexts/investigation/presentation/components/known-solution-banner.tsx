'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { KnownSolution } from '@/contexts/investigation/domain/types';

// ---------------------------------------------------------------------------
// Known Solution Banner
// ---------------------------------------------------------------------------

interface KnownSolutionBannerProps {
  knownSolution: KnownSolution;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
}

export function KnownSolutionBanner({
  knownSolution,
  onAccept,
  onDecline,
}: KnownSolutionBannerProps) {
  const t = useTranslations('dashboard.incidents.detail.knownSolution');
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  const isBusy = isAccepting || isDeclining;

  async function handleAccept() {
    setIsAccepting(true);
    try {
      await onAccept();
    } finally {
      setIsAccepting(false);
    }
  }

  async function handleDecline() {
    setIsDeclining(true);
    try {
      await onDecline();
    } finally {
      setIsDeclining(false);
    }
  }

  return (
    <section className="rounded-xl border-2 border-warning/60 bg-warning/10 p-5 shadow-sm /40">
      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-warning"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
        <div className="flex-1 space-y-3">
          <h3 className="text-sm font-semibold text-warning">
            {t('title')}{' '}
            <span className="font-normal text-warning">
              {t('confidence', { confidence: Math.round(knownSolution.confidence * 100) })}
            </span>
          </h3>

          <div className="space-y-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-warning/80 /80">
                {t('rootCause')}
              </p>
              <p className="text-sm text-warning leading-relaxed whitespace-pre-wrap">
                {knownSolution.rootCause}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-warning/80 /80">
                {t('recommendedFix')}
              </p>
              <p className="text-sm text-warning leading-relaxed whitespace-pre-wrap">
                {knownSolution.recommendedFix}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleAccept}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-success/80 px-4 py-2 text-sm font-medium text-white hover:bg-success/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed dark:hover:bg-success/80"
            >
              {isAccepting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  {t('accepting')}
                </>
              ) : (
                <>
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {t('accept')}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDecline}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-warning/60 bg-transparent px-4 py-2 text-sm font-medium text-warning hover:bg-warning/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed dark:hover:bg-warning/80/50"
            >
              {isDeclining ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  {t('declining')}
                </>
              ) : (
                t('decline')
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

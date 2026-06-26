'use client';

import { cn } from '@causeflow/ui/lib';
import { useTranslations } from 'next-intl';

type CardKey =
  | 'builtByEM'
  | 'minutesNotHours'
  | 'crossTool'
  | 'gracefulDegradation'
  | 'builtForStartups'
  | 'platformCompanies';

interface CardConfig {
  key: CardKey;
  hasSource?: boolean;
  icon: React.ReactNode;
}

const cards: CardConfig[] = [
  {
    key: 'builtByEM',
    icon: (
      <svg
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.42 15.17l-5.384-3.086A1.5 1.5 0 016 10.731V6.731a1.5 1.5 0 01.036-.357m11.963 0A1.5 1.5 0 0118 6.731v4a1.5 1.5 0 01-.036.357M15 11.25l-3-1.5m0 0l-3 1.5m3-1.5v4.5m-3-4.5l3 1.5m0 0l3-1.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    key: 'minutesNotHours',
    hasSource: true,
    icon: (
      <svg
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
        />
      </svg>
    ),
  },
  {
    key: 'crossTool',
    icon: (
      <svg
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
    ),
  },
  {
    key: 'gracefulDegradation',
    icon: (
      <svg
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
    ),
  },
  {
    key: 'builtForStartups',
    icon: (
      <svg
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
        />
      </svg>
    ),
  },
  {
    key: 'platformCompanies',
    hasSource: true,
    icon: (
      <svg
        aria-hidden="true"
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z"
        />
      </svg>
    ),
  },
];

export function WhyDifferentSection({ className }: { className?: string }) {
  const t = useTranslations('home.whyDifferent');

  return (
    <section className={cn('py-16 sm:py-20 lg:py-24', className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {cards.map((card) => (
            <div
              key={card.key}
              className="group rounded-lg border border-border bg-background p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {card.icon}
              </div>
              <h3 className="text-base font-semibold">{t(`cards.${card.key}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(`cards.${card.key}.description`)}
              </p>
              {card.hasSource && (
                <p className="mt-3 text-xs text-muted-foreground/70">
                  {card.key === 'platformCompanies' ? (
                    <a
                      href={t(`cards.${card.key}.sourceUrl`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-muted-foreground hover:underline"
                    >
                      {t(`cards.${card.key}.source`)}
                    </a>
                  ) : (
                    t(`cards.${card.key}.source`)
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

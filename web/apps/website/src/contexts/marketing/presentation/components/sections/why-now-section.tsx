'use client';

import { cn } from '@causeflow/ui/lib';
import { useTranslations } from 'next-intl';

interface WhyNowCardProps {
  title: string;
  body: string;
  sources: { label: string; url: string }[];
  icon: React.ReactNode;
  className?: string;
}

function WhyNowCard({ title, body, sources, icon, className }: WhyNowCardProps) {
  return (
    <div
      className={cn(
        'group rounded-lg border border-border bg-[#111113] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5',
        className,
      )}
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {sources.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground/70 hover:text-muted-foreground hover:underline"
            >
              {source.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const CODE_ICON = (
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
);

const ALERT_ICON = (
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
      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
    />
  </svg>
);

export function WhyNowSection({ className }: { className?: string }) {
  const t = useTranslations('home.whyNow');

  const cards = [
    {
      key: 'card1',
      icon: CODE_ICON,
      title: t('card1.title'),
      body: t('card1.body'),
      sources: [
        { label: t('card1.source1'), url: t('card1.source1Url') },
        { label: t('card1.source2'), url: t('card1.source2Url') },
      ],
    },
    {
      key: 'card2',
      icon: ALERT_ICON,
      title: t('card2.title'),
      body: t('card2.body'),
      sources: [{ label: t('card2.source1'), url: t('card2.source1Url') }],
    },
  ];

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
            <WhyNowCard
              key={card.key}
              title={card.title}
              body={card.body}
              sources={card.sources}
              icon={card.icon}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

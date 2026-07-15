'use client';

import { Button } from '@causeflow/ui/primitives';
import { useTranslations } from 'next-intl';
import { ossMarketingDocsCta } from '@/lib/oss-marketing-ctas';

interface StatCardProps {
  value: string;
  label: string;
  source: string;
  sourceUrl?: string;
}

function StatCard({ value, label, source, sourceUrl }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-[#111113] p-6 text-center ring-1 ring-accent/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-accent/5 hover:ring-accent/20">
      <div className="text-4xl font-bold text-primary sm:text-5xl">{value}</div>
      <div className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <p className="mt-3 text-xs text-muted-foreground/70">
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground hover:underline"
          >
            {source}
          </a>
        ) : (
          source
        )}
      </p>
    </div>
  );
}

export function CategoryIsRealSection({ className }: { className?: string }) {
  const t = useTranslations('home.categoryIsReal');

  return (
    <section className={`py-16 sm:py-20 lg:py-24 ${className ?? ''}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard value={t('card1.value')} label={t('card1.label')} source={t('card1.source')} />
          <StatCard
            value={t('card2.value')}
            label={t('card2.label')}
            source={t('card2.source')}
            sourceUrl={t('card2.sourceUrl')}
          />
          <StatCard
            value={t('card3.value')}
            label={t('card3.label')}
            source={t('card3.source')}
            sourceUrl={t('card3.sourceUrl')}
          />
        </div>
        <div className="mt-12 rounded-lg border border-primary/20 bg-primary/5 px-6 py-8 text-center">
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-foreground sm:text-lg">
            {t('statement')}
          </p>
          <div className="mt-6">
            <a href={ossMarketingDocsCta(t('cta')).href} target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                {t('cta')}
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

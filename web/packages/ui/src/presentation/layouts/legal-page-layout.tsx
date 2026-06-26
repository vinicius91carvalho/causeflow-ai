'use client';

import type * as React from 'react';
import { cn } from '../../lib/utils';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated?: string;
  children: React.ReactNode;
  className?: string;
}

export function LegalPageLayout({ title, lastUpdated, children, className }: LegalPageLayoutProps) {
  return (
    <article className={cn('mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8', className)}>
      <header className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {lastUpdated && (
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        )}
      </header>
      <div className="prose prose-slate max-w-none dark:prose-invert">{children}</div>
    </article>
  );
}

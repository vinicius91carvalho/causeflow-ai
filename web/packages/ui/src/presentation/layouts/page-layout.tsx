'use client';

import type * as React from 'react';
import { cn } from '../../lib/utils';

interface PageLayoutProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function PageLayout({ children, header, footer, className }: PageLayoutProps) {
  return (
    <div className={cn('flex min-h-screen flex-col', className)}>
      {header}
      <main id="main-content" className="flex-1">
        {children}
      </main>
      {footer}
    </div>
  );
}

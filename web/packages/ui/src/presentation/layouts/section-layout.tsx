'use client';

import type * as React from 'react';
import { cn } from '../../lib/utils';

type SectionVariant = 'default' | 'dark' | 'muted' | 'accent';

interface SectionLayoutProps {
  children: React.ReactNode;
  variant?: SectionVariant;
  className?: string;
  id?: string;
  as?: 'section' | 'div';
}

const variantStyles: Record<SectionVariant, string> = {
  default: 'bg-background text-foreground',
  dark: 'bg-slate-950 text-white',
  muted: 'bg-muted text-foreground',
  accent: 'bg-primary/5 text-foreground',
};

export function SectionLayout({
  children,
  variant = 'default',
  className,
  id,
  as: Component = 'section',
}: SectionLayoutProps) {
  return (
    <Component
      id={id}
      className={cn(
        'px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24',
        variantStyles[variant],
        className,
      )}
    >
      <div className="mx-auto max-w-7xl">{children}</div>
    </Component>
  );
}

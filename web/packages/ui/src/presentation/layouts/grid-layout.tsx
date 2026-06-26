'use client';

import type * as React from 'react';
import { cn } from '../../lib/utils';

interface GridLayoutProps {
  children: React.ReactNode;
  columns?: { sm?: number; md?: number; lg?: number; xl?: number };
  gap?: string;
  className?: string;
}

const smColsMap: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

const mdColsMap: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

const lgColsMap: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};

const xlColsMap: Record<number, string> = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
};

export function GridLayout({
  children,
  columns = { sm: 1, md: 2, lg: 3 },
  gap = 'gap-6',
  className,
}: GridLayoutProps) {
  const colClasses = [
    columns.sm ? (smColsMap[columns.sm] ?? 'grid-cols-1') : 'grid-cols-1',
    columns.md ? (mdColsMap[columns.md] ?? '') : '',
    columns.lg ? (lgColsMap[columns.lg] ?? '') : '',
    columns.xl ? (xlColsMap[columns.xl] ?? '') : '',
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={cn('grid', colClasses, gap, className)}>{children}</div>;
}
